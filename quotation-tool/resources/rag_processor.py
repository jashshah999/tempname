from typing import Dict, List, Any, Optional, Literal
import pandas as pd
from openai import OpenAI
import logging
from datetime import datetime
import json
from pathlib import Path
import numpy as np
from dataclasses import dataclass, field
import pickle
from tqdm import tqdm
import networkx as nx
import argparse
import requests  # Add this import for Ollama API calls
import ollama

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('rag_processor.log')
    ]
)


@dataclass
class SearchResult:
    """Data class for search results"""
    data: Dict[str, Any]
    similarity_score: float
    embedding_id: str
    rank: int


@dataclass
class GraphNode:
    """Data class for graph nodes"""
    id: str
    data: Dict[str, Any]
    node_type: str
    embedding: List[float] = field(default_factory=list)
    connections: List[str] = field(default_factory=list)


class RAGProcessor:
    def __init__(self,
                 api_key: str = None,  # Made optional since Ollama doesn't need API key
                 rag_type: Literal["normal", "graph"] = "normal",
                 model: str = "deepseek-r1:7b",  # Changed to Ollama model name
                 index_dir: str = "rag_indexes",
                 index_file: str = None,
                 ollama_base_url: str = "http://localhost:11434/"):  # Added Ollama URL
        """
        Initialize RAG Processor

        Args:
            api_key: OpenAI API key (only needed for embeddings)
            rag_type: Type of RAG to use ("normal" or "graph")
            model: Ollama model to use (default is deepseek-r1:7b)
            index_dir: Directory for storing indexes
            index_file: Specific index file to use
            ollama_base_url: Base URL for Ollama API
        """
        self.logger = logging.getLogger(__name__)
        self.logger.info(f"Initializing {rag_type} RAG Processor with {model}")

        self.rag_type = rag_type
        self.model = model
        self.ollama_url = ollama_base_url
        self.client = OpenAI(api_key=api_key)  # Keep OpenAI client for embeddings only
        self.index_dir = Path(index_dir)
        self.index_file = Path(index_file) if index_file else None
        self.index_dir.mkdir(exist_ok=True)

        self.df = None
        self.embeddings = {}
        self.schema_understanding = None

        # Graph-specific attributes
        if rag_type == "graph":
            self.graph = nx.Graph()
            self.nodes = {}

        # Load index if provided
        if self.index_file and self.index_file.exists():
            self.load_from_index(self.index_file)

    def _get_embedding(self, text: str) -> List[float]:
        """Get embedding for text using OpenAI's embedding model"""
        try:
            response = self.client.embeddings.create(
                model="text-embedding-3-small",
                input=text
            )
            return response.data[0].embedding
        except Exception as e:
            self.logger.error(f"Error getting embedding: {e}")
            raise

    def _create_row_text(self, row: pd.Series) -> str:
        """Create searchable text from row data"""
        return " ".join(f"{col}: {val}" for col, val in row.items())

    def _compute_similarity(self, query_embedding: List[float], doc_embedding: List[float]) -> float:
        """Compute cosine similarity between embeddings"""
        return np.dot(query_embedding, doc_embedding) / (
                np.linalg.norm(query_embedding) * np.linalg.norm(doc_embedding)
        )

    def _build_graph(self) -> None:
        """Build knowledge graph from data"""
        if self.rag_type != "graph":
            return

        try:
            self.logger.info("Building knowledge graph")
            self.graph.clear()

            # Create nodes for each row
            for idx, row in self.df.iterrows():
                node_id = f"doc_{idx}"
                node_data = row.to_dict()

                # Create graph node
                node = GraphNode(
                    id=node_id,
                    data=node_data,
                    node_type="product",
                    embedding=self._get_embedding(self._create_row_text(row))
                )

                self.nodes[node_id] = node
                self.graph.add_node(node_id, **node_data)

            # Create edges based on relationships
            if self.schema_understanding and 'relationships' in self.schema_understanding:
                for rel in self.schema_understanding['relationships']:
                    from_col = rel['from']
                    to_col = rel['to']

                    # Create edges between nodes with matching values
                    values_dict = {}
                    for node_id, node in self.nodes.items():
                        from_val = node.data.get(from_col)
                        if from_val:
                            if from_val not in values_dict:
                                values_dict[from_val] = []
                            values_dict[from_val].append(node_id)

                    # Connect nodes with same values
                    for nodes in values_dict.values():
                        for i in range(len(nodes)):
                            for j in range(i + 1, len(nodes)):
                                self.graph.add_edge(nodes[i], nodes[j],
                                                    relationship_type=rel['type'])

            self.logger.info(f"Built graph with {self.graph.number_of_nodes()} nodes "
                             f"and {self.graph.number_of_edges()} edges")

        except Exception as e:
            self.logger.error(f"Error building graph: {e}")
            raise

    def load_from_index(self, index_path: Path) -> None:
        """Load data from index file"""
        try:
            self.logger.info(f"Loading from index file: {index_path}")
            with open(index_path, 'rb') as f:
                saved_data = pickle.load(f)
                self.df = saved_data['df']
                self.embeddings = saved_data['embeddings']
                self.schema_understanding = saved_data['schema']

                if self.rag_type == "graph":
                    if 'graph' in saved_data:
                        self.graph = saved_data['graph']
                        self.nodes = saved_data['nodes']
                    else:
                        self._build_graph()

            self.logger.info(f"Loaded index with {len(self.embeddings)} embeddings")
        except Exception as e:
            self.logger.error(f"Error loading index file: {e}")
            raise

    def load_data(self, file_path: str, force_rebuild: bool = False) -> None:
        """Load data and create index"""
        try:
            self.logger.info(f"Loading data from {file_path}")

            # Use specified index file if provided, otherwise generate path
            index_file = self.index_file if self.index_file else self.index_dir / f"{Path(file_path).stem}_index.pkl"

            # Try to load existing index
            if not force_rebuild and index_file.exists():
                self.load_from_index(index_file)
                return

            # Load new data
            self.df = pd.read_excel(file_path)
            self.logger.info(f"Loaded Excel file with shape: {self.df.shape}")

            # Analyze schema
            self.logger.info("Analyzing schema")
            self._analyze_schema()

            # Create embeddings
            self.logger.info("Creating embeddings for each row")
            self.embeddings = {}

            for idx, row in tqdm(self.df.iterrows(), total=len(self.df)):
                row_text = self._create_row_text(row)
                self.embeddings[f"doc_{idx}"] = {
                    'embedding': self._get_embedding(row_text),
                    'text': row_text,
                    'row_data': row.to_dict()
                }

            # Add graph building for graph RAG
            if self.rag_type == "graph":
                self._build_graph()

            # Save index with graph data if needed
            save_data = {
                'df': self.df,
                'embeddings': self.embeddings,
                'schema': self.schema_understanding,
                'created_at': datetime.now().isoformat()
            }

            if self.rag_type == "graph":
                save_data.update({
                    'graph': self.graph,
                    'nodes': self.nodes
                })

            with open(index_file, 'wb') as f:
                pickle.dump(save_data, f)

            self.logger.info("Data loading and indexing completed")

        except Exception as e:
            self.logger.error(f"Error loading data: {e}")
            raise

    def _call_ollama(self, messages: List[Dict], json_response: bool = False) -> Dict:
        """Helper method to call Ollama API"""
        try:
            # headers = {"Content-Type": "application/json"}
            # data = {
            #     "model": self.model,
            #     "messages": messages,
            #     "stream": False,
            #     "format": "json" if json_response else "text"
            # }
            #
            # response = requests.post(
            #     f"{self.ollama_url}api/generate",
            #     headers=headers,
            #     json=data
            # )
            # response.raise_for_status()

            response = ollama.chat(
                model=self.model,
                messages=messages,
                stream=False,
                format="json" if json_response else "text"
            )
            return response.message.content
            # result = response.json()
            # return result["message"]["content"]

        except Exception as e:
            self.logger.error(f"Error calling Ollama API: {e}")
            raise

    def _analyze_schema(self) -> None:
        """Analyze schema using DeepSeek Chat via Ollama"""
        try:
            sample_data = self.df.head(50).to_string()
            columns = self.df.columns.tolist()

            prompt = f"""Analyze this Excel data structure and return a valid JSON object with the exact structure shown below.

            Excel Columns: {columns}
            Sample Data First 50 Rows:
            {sample_data}

            Return ONLY a valid JSON object with exactly this structure (no other text):
            {{
                "column_analysis": {{
                    "columns": {{
                        "column_name": {{
                            "type": "string/number/etc",
                            "description": "what this column contains",
                            "format": "any special format noticed"
                        }}
                    }},
                    "primary_keys": ["list of columns that uniquely identify rows"],
                    "value_columns": ["list of columns containing values/metrics"]
                }},
                "relationships": [
                    {{
                        "from": "column_name",
                        "to": "column_name",
                        "type": "relationship type"
                    }}
                ],
                "data_patterns": {{
                    "pattern_name": "pattern description"
                }},
                "query_examples": [
                    {{
                        "type": "query type",
                        "example": "example query",
                        "columns_used": ["columns"]
                    }}
                ]
            }}"""

            self.logger.debug("Sending schema analysis prompt to DeepSeek via Ollama")
            messages = [
                {
                    "role": "system",
                    "content": "You are a data structure analyzer. You must return ONLY a valid JSON object with the exact structure requested, no additional text or markdown."
                },
                {"role": "user", "content": prompt}
            ]

            content = self._call_ollama(messages, json_response=True)

            # Validate JSON before saving
            try:
                self.schema_understanding = json.loads(content) if isinstance(content, str) else content
                self.logger.info("Schema analysis completed successfully")
                self.logger.info(f"Schema understanding: {json.dumps(self.schema_understanding, indent=2)}")
            except json.JSONDecodeError as je:
                self.logger.error(f"Invalid JSON in response: {je}")
                self.logger.error(f"Content causing error: {content}")
                raise

        except Exception as e:
            self.logger.error(f"Error analyzing schema: {e}")
            raise

    def query(self, query: str, top_k: int = 6) -> List[Dict]:
        """Process query using either normal or graph RAG"""
        if self.rag_type == "normal":
            return self._normal_query(query, top_k)
        else:
            return self._graph_query(query, top_k)

    def _normal_query(self, query: str, top_k: int = 6) -> List[Dict]:
        """Original query method for normal RAG"""
        try:
            self.logger.info(f"Processing query: {query}")

            # Get query embedding
            query_embedding = self._get_embedding(query)

            # Calculate similarities
            similarities = []
            for doc_id, doc_data in self.embeddings.items():
                score = self._compute_similarity(query_embedding, doc_data['embedding'])
                similarities.append((doc_id, score))

            # Sort by similarity
            similarities.sort(key=lambda x: x[1], reverse=True)

            # Get top k results
            top_results = []
            for rank, (doc_id, score) in enumerate(similarities[:top_k]):
                result = SearchResult(
                    data=self.embeddings[doc_id]['row_data'],
                    similarity_score=score,
                    embedding_id=doc_id,
                    rank=rank + 1
                )
                top_results.append(result)

            # Format results using Ollama
            response = self._format_results(query, top_results)

            self.logger.info(f"Found {len(top_results)} matches")
            return response

        except Exception as e:
            self.logger.error(f"Error processing query: {e}")
            raise

    def _graph_query(self, query: str, top_k: int = 6) -> List[Dict]:
        """Query using graph-based RAG"""
        try:
            self.logger.info(f"Processing graph query: {query}")

            # Get query embedding
            query_embedding = self._get_embedding(query)

            # Find initial matches
            similarities = []
            for node_id, node in self.nodes.items():
                score = self._compute_similarity(query_embedding, node.embedding)
                similarities.append((node_id, score))

            # Sort by similarity
            similarities.sort(key=lambda x: x[1], reverse=True)

            # Get top matches and their neighbors
            results = []
            seen_nodes = set()

            for node_id, score in similarities[:top_k]:
                if node_id not in seen_nodes:
                    # Add the node
                    node_data = self.nodes[node_id].data
                    results.append(SearchResult(
                        data=node_data,
                        similarity_score=score,
                        embedding_id=node_id,
                        rank=len(results) + 1
                    ))
                    seen_nodes.add(node_id)

                    # Add connected nodes
                    for neighbor in self.graph.neighbors(node_id):
                        if neighbor not in seen_nodes:
                            neighbor_node = self.nodes[neighbor]
                            neighbor_score = self._compute_similarity(
                                query_embedding, neighbor_node.embedding
                            )
                            results.append(SearchResult(
                                data=neighbor_node.data,
                                similarity_score=neighbor_score,
                                embedding_id=neighbor,
                                rank=len(results) + 1
                            ))
                            seen_nodes.add(neighbor)

            # Format results using Ollama
            response = self._format_results(query, results[:top_k])

            self.logger.info(f"Found {len(results)} matches using graph RAG")
            return response

        except Exception as e:
            self.logger.error(f"Error processing graph query: {e}")
            raise

    def _format_results(self, query: str, results: List[SearchResult]) -> Dict:
        """Format results using DeepSeek via Ollama"""
        try:
            # First get all potential matches
            initial_prompt = f"""Given this query: "{query}"
            Top {len(results)} matches (sorted by relevance):
            {json.dumps([{
                'rank': r.rank,
                'data': r.data,
                'score': r.similarity_score,
                'confidence': 'high' if r.similarity_score > 0.8 else 'medium' if r.similarity_score > 0.6 else 'low'
            } for r in results], indent=2)}

            Return a JSON with:
            1. Top matches (include all relevant matches)
            2. Confidence for each match
            3. Reasoning for matches
            4. Any relevant context or patterns noticed
            """

            initial_response = self._call_ollama([
                {"role": "system", "content": "You are a data analyst. Return only valid JSON."},
                {"role": "user", "content": initial_prompt}
            ], json_response=True)

            initial_results = initial_response if isinstance(initial_response, dict) else json.loads(initial_response)

            # Second pass to find best match
            refinement_prompt = f"""These are some of the possible outcomes:
            {json.dumps(initial_results, indent=2)}

            And this is the original requirement/query: "{query}"

            Find the best match and return in this exact JSON format:
            {{
                "best_match": {{
                    "data": {{}},           # The best matching row data
                    "confidence": "",       # high/medium/low
                    "reason": ""            # Why this is the best match
                }},
                "alternative_matches": [    # Up to 2 alternative matches if relevant
                    {{
                        "data": {{}},
                        "confidence": "",
                        "reason": ""
                    }}
                ]
            }}
            """

            final_response = self._call_ollama([
                {"role": "system", "content": "You are a data analyst. Return only the JSON object, no other text."},
                {"role": "user", "content": refinement_prompt}
            ], json_response=True)

            return final_response if isinstance(final_response, dict) else json.loads(final_response)

        except Exception as e:
            self.logger.error(f"Error formatting results: {e}")
            raise

    def save_best_match(self, results: Dict, output_file: str = "best_match_results.json") -> None:
        """
        Save only the best match result to a JSON file.

        Args:
            results (Dict): Results dictionary containing best match and alternatives
            output_file (str): Path to save the JSON file
        """
        try:
            self.logger.info(f"Saving best match result to {output_file}")
            # Extract only the best match data
            print(results)
            best_match = {
                "best_match": results["best_match"]
            }
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(best_match, f, indent=2, ensure_ascii=False)
            self.logger.info("Best match result saved successfully")
        except Exception as e:
            self.logger.error(f"Error saving best match result: {e}")
            raise


# Example usage
if __name__ == "__main__":
    try:
        # Create argument parser
        parser = argparse.ArgumentParser(description='RAG Processor')
        parser.add_argument('--api-key', type=str, required=True, help='OpenAI API key')
        parser.add_argument('--rag-type', type=str, choices=['normal', 'graph'],
                            default='normal', help='Type of RAG to use')
        parser.add_argument('--input-file', type=str, required=True,
                            help='Input Excel file to process')
        parser.add_argument('--index-file', type=str, default=None,
                            help='Optional specific index file to use')

        args = parser.parse_args()

        # Initialize processor with arguments
        processor = RAGProcessor(
            api_key=args.api_key,
            rag_type=args.rag_type,
            index_file=args.index_file
        )

        # Load data (will use existing index if available)
        processor.load_data(args.input_file)

        while True:
            query = input("\nEnter your query (or 'exit' to quit): ")
            if query.lower() == 'exit':
                break

            # Get results
            results = processor.query(query)

            # Save results to JSON
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_file = f"best_match_results_{timestamp}.json"
            processor.save_best_match(results, output_file)

            # Print formatted results
            print("\n=== Best Match ===")
            print(json.dumps(results["best_match"], indent=2))

            print("\n=== Match Reasoning ===")
            print(f"Confidence: {results['best_match']['confidence']}")
            print(f"Reason: {results['best_match']['reason']}")
            print(f"\nResults saved to: {output_file}")

    except Exception as e:
        logging.error(f"Application error: {e}", exc_info=True)
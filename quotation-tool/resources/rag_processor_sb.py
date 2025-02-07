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
from supabase import Client, create_client


class RAGProcessor:
    def __init__(self,
                 api_key: str = None,
                 rag_type: Literal["normal", "graph"] = "normal",
                 model: str = "deepseek-r1:7b",
                 supabase_url: str = None,  # Add Supabase URL
                 supabase_key: str = None,  # Add Supabase key
                 ollama_base_url: str = "http://localhost:11434/"):
        """
        Initialize RAG Processor with Supabase
        """
        # ... keep existing init code ...

        # Initialize Supabase client
        self.supabase: Client = create_client(supabase_url, supabase_key)

        # Check and create tables if needed
        self._init_supabase_tables()

    def _init_supabase_tables(self):
        """Ensure required tables exist in Supabase"""
        # This is just an example - you should create proper migrations in real code
        try:
            self.supabase.table('documents').select('*').limit(1).execute()
        except Exception as e:
            self.logger.info("Creating documents table")
            self.supabase.rpc('create_documents_table', {}).execute()

    def load_from_index(self, index_name: str) -> None:
        """Load data from Supabase"""
        try:
            self.logger.info(f"Loading from Supabase index: {index_name}")

            # Load documents
            docs_response = self.supabase.table('documents') \
                .select('*') \
                .eq('index_name', index_name) \
                .execute()
            self.df = pd.DataFrame([doc['content'] for doc in docs_response.data])

            # Load embeddings
            embeddings_response = self.supabase.table('embeddings') \
                .select('*') \
                .eq('index_name', index_name) \
                .execute()
            self.embeddings = {e['doc_id']: e for e in embeddings_response.data}

            # Load schema
            schema_response = self.supabase.table('schemas') \
                .select('*') \
                .eq('index_name', index_name) \
                .execute()
            self.schema_understanding = schema_response.data[0]['schema'] if schema_response.data else None

            # Load graph data if needed
            if self.rag_type == "graph":
                nodes_response = self.supabase.table('graph_nodes') \
                    .select('*') \
                    .eq('index_name', index_name) \
                    .execute()
                self.nodes = {n['node_id']: GraphNode(**n) for n in nodes_response.data}

                edges_response = self.supabase.table('graph_edges') \
                    .select('*') \
                    .eq('index_name', index_name) \
                    .execute()
                self.graph = nx.Graph()
                for edge in edges_response.data:
                    self.graph.add_edge(edge['source'], edge['target'])

        except Exception as e:
            self.logger.error(f"Error loading from Supabase: {e}")
            raise

    def load_data(self, file_path: str, index_name: str, force_rebuild: bool = False) -> None:
        """Load data and create index in Supabase"""
        try:
            # Check if index exists
            if not force_rebuild:
                try:
                    self.load_from_index(index_name)
                    return
                except:
                    pass

            # Load new data
            self.df = pd.read_excel(file_path)

            # Store documents in Supabase
            documents = []
            for idx, row in self.df.iterrows():
                doc_id = str(uuid.uuid4())
                documents.append({
                    'doc_id': doc_id,
                    'content': row.to_dict(),
                    'index_name': index_name,
                    'created_at': datetime.now().isoformat()
                })

            # Batch insert documents
            self.supabase.table('documents').insert(documents).execute()

            # Create and store embeddings
            embeddings = []
            for idx, row in tqdm(self.df.iterrows(), total=len(self.df)):
                doc_id = documents[idx]['doc_id']
                row_text = self._create_row_text(row)
                embedding = self._get_embedding(row_text)

                embeddings.append({
                    'doc_id': doc_id,
                    'embedding': embedding,
                    'text': row_text,
                    'index_name': index_name,
                    'created_at': datetime.now().isoformat()
                })

            # Batch insert embeddings
            self.supabase.table('embeddings').insert(embeddings).execute()

            # Store schema
            self._analyze_schema()
            self.supabase.table('schemas').insert({
                'index_name': index_name,
                'schema': self.schema_understanding,
                'created_at': datetime.now().isoformat()
            }).execute()

            # Store graph data if needed
            if self.rag_type == "graph":
                self._build_graph(index_name)

            self.logger.info("Data loading and indexing completed in Supabase")

        except Exception as e:
            self.logger.error(f"Error loading data to Supabase: {e}")
            raise

    def _build_graph(self, index_name: str) -> None:
        """Build and store graph in Supabase"""
        try:
            # ... keep existing graph building logic ...

            # Store nodes
            nodes_data = []
            for node_id, node in self.nodes.items():
                nodes_data.append({
                    'node_id': node_id,
                    'data': node.data,
                    'node_type': node.node_type,
                    'embedding': node.embedding,
                    'index_name': index_name
                })
            self.supabase.table('graph_nodes').insert(nodes_data).execute()

            # Store edges
            edges_data = []
            for edge in self.graph.edges():
                edges_data.append({
                    'source': edge[0],
                    'target': edge[1],
                    'index_name': index_name,
                    'relationship_type': self.graph.edges[edge].get('relationship_type', 'related')
                })
            self.supabase.table('graph_edges').insert(edges_data).execute()

        except Exception as e:
            self.logger.error(f"Error building graph in Supabase: {e}")
            raise

    def query(self, query: str, index_name: str, top_k: int = 6) -> List[Dict]:
        """Modified query method to use Supabase vector search"""
        try:
            # Get query embedding
            query_embedding = self._get_embedding(query)

            # Perform vector search in Supabase
            results = self.supabase.rpc('vector_search', {
                'query_embedding': query_embedding,
                'index_name': index_name,
                'match_count': top_k
            }).execute()

            # Process results
            top_results = []
            for rank, result in enumerate(results.data):
                top_results.append(SearchResult(
                    data=result['content'],
                    similarity_score=result['similarity'],
                    embedding_id=result['doc_id'],
                    rank=rank + 1
                ))

            # ... rest of query processing remains the same ...
            return self._format_results(query, top_results)

        except Exception as e:
            self.logger.error(f"Error querying Supabase: {e}")
            raise
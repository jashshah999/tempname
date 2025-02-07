import pandas as pd
from rapidfuzz import fuzz, process
from typing import List, Dict, Union
import logging
import json
from pathlib import Path
from openai import OpenAI
import os
import faiss
from sentence_transformers import SentenceTransformer
import numpy as np
from tqdm import tqdm

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class DataLoader:
    """Handles loading and preprocessing of Excel/CSV data"""
    def __init__(self, file_path: str):
        self.file_path = Path(file_path)
        self.df = None
        self.llm_client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

    def load(self) -> pd.DataFrame:
        """Load and preprocess the data file"""
        try:
            if self.file_path.suffix.lower() == '.csv':
                self.df = pd.read_csv(self.file_path)
            elif self.file_path.suffix.lower() in ['.xlsx', '.xls']:
                # Try to load saved header info first
                header_row_idx = self._load_header_info()

                if header_row_idx is None:
                    # If no saved header info, detect it and save
                    df_temp = pd.read_excel(self.file_path)
                    header_row_idx = self._detect_header_row(df_temp)
                    self._save_header_info(header_row_idx)
                    self.df = pd.read_excel(self.file_path, skiprows=header_row_idx+1)
                    self.df.columns = df_temp.iloc[header_row_idx]
                else:
                    print(f"Using saved header information (row {header_row_idx})")
                    self.df = pd.read_excel(self.file_path, skiprows=header_row_idx+1)
                    df_temp = pd.read_excel(self.file_path)
                    self.df.columns = df_temp.iloc[header_row_idx]
            else:
                raise ValueError(f"Unsupported file format: {self.file_path.suffix}")

            # Clean column names and convert to string
            self.df.columns = [str(col).strip().lower().replace(' ', '_') for col in self.df.columns]
            self.df = self.df.astype(str)

            logging.info(f"Successfully loaded data with {len(self.df)} rows")
            logging.info(f"Columns: {list(self.df.columns)}")

            return self.df

        except Exception as e:
            logging.error(f"Error loading data: {str(e)}")
            raise

    def _save_header_info(self, header_row_idx: int) -> None:
        """Save header information to JSON file"""
        header_dir = Path("header_info")
        header_dir.mkdir(exist_ok=True)

        header_info = {
            'header_row_index': header_row_idx,
            'file_hash': self._get_file_hash()
        }

        header_path = header_dir / f"{self.file_path.stem}_header.json"
        with open(header_path, 'w') as f:
            json.dump(header_info, f)
        print(f"Saved header information to {header_path}")

    def _load_header_info(self) -> Union[int, None]:
        """Load saved header information if it exists and matches file hash"""
        try:
            header_dir = Path("header_info")
            header_path = header_dir / f"{self.file_path.stem}_header.json"

            if not header_path.exists():
                return None

            with open(header_path, 'r') as f:
                header_info = json.load(f)

            # Verify file hasn't changed using hash
            if header_info.get('file_hash') == self._get_file_hash():
                print("Found saved header information")
                return header_info.get('header_row_index')
            else:
                print("File has changed, detecting headers again")
                return None

        except Exception as e:
            logging.error(f"Error loading header info: {str(e)}")
            return None

    def _get_file_hash(self) -> str:
        """Get hash of file for change detection"""
        import hashlib

        hash_md5 = hashlib.md5()
        with open(self.file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()

    def _detect_header_row(self, df: pd.DataFrame) -> int:
        """Use LLM to detect header row"""
        try:
            sample_df = df.head(50)
            n_cols = min(5, len(sample_df.columns))
            preview_df = sample_df.iloc[:, :n_cols]
            data_preview = preview_df.to_string(max_rows=50, max_cols=n_cols, line_width=80)

            prompt = f"""Excel data preview (first 50 rows, showing {n_cols} columns):
            {data_preview}
            Return JSON with header row index (0-based) and column names. Format:
            {{"header_row_index": N, "column_names": ["col1", "col2", ...]}}"""

            response = self.llm_client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You are a data analysis assistant. Return only JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0,
                max_tokens=500
            )

            result = json.loads(response.choices[0].message.content)
            return result.get('header_row_index', 0)

        except Exception as e:
            logging.error(f"Error in header detection: {str(e)}")
            return 0

class VectorIndexer:
    """Handles vector indexing of data using FAISS"""
    def __init__(self, embedding_model_name: str = 'all-MiniLM-L6-v2'):
        self.embedding_model = SentenceTransformer(embedding_model_name)
        self.index = None
        self.embeddings = None

    def create_index(self, df: pd.DataFrame) -> None:
        """Create FAISS index from DataFrame"""
        print("\nStarting indexing process...")

        text_columns = self._get_text_columns(df)
        texts = self._combine_texts(df, text_columns)
        self.embeddings = self._create_embeddings(texts)
        self._build_faiss_index()

    def _get_text_columns(self, df: pd.DataFrame) -> List[str]:
        """Identify text columns for indexing"""
        text_columns = []
        for col in df.columns:
            sample = df[col].dropna().head(100)
            if sample.dtype == object and sample.str.len().mean() > 3:
                text_columns.append(col)
        return text_columns

    def _combine_texts(self, df: pd.DataFrame, text_columns: List[str]) -> List[str]:
        """Combine text columns into single strings"""
        texts = []
        for _, row in tqdm(df.iterrows(), total=len(df), desc="Combining text"):
            text = " ".join(str(row[col]) for col in text_columns if pd.notna(row[col]))
            texts.append(text)
        return texts

    def _create_embeddings(self, texts: List[str]) -> np.ndarray:
        """Create embeddings for texts"""
        print("\nGenerating embeddings...")
        batch_size = 32
        embeddings = []

        for i in tqdm(range(0, len(texts), batch_size), desc="Creating embeddings"):
            batch = texts[i:i + batch_size]
            batch_embeddings = self.embedding_model.encode(batch)
            embeddings.extend(batch_embeddings)

        return np.array(embeddings).astype('float32')

    def _build_faiss_index(self) -> None:
        """Build FAISS index from embeddings"""
        print("\nCreating FAISS index...")
        dimension = self.embeddings.shape[1]
        self.index = faiss.IndexFlatL2(dimension)
        self.index.add(self.embeddings)
        print(f"Indexing complete! {len(self.embeddings)} rows indexed with dimension {dimension}")

class IndexManager:
    """Manages saving and loading of indices"""
    @staticmethod
    def save_index(index: faiss.Index, embeddings: np.ndarray, file_stem: str) -> None:
        """Save FAISS index and embeddings"""
        index_dir = Path("index_data")
        index_dir.mkdir(exist_ok=True)

        index_path = index_dir / f"{file_stem}_index.faiss"
        embeddings_path = index_dir / f"{file_stem}_embeddings.npy"

        faiss.write_index(index, str(index_path))
        np.save(embeddings_path, embeddings)

        print(f"Index saved to {index_path}")
        print(f"Embeddings saved to {embeddings_path}")

    @staticmethod
    def load_index(file_stem: str) -> tuple:
        """Load saved index and embeddings"""
        index_dir = Path("index_data")
        index_path = index_dir / f"{file_stem}_index.faiss"
        embeddings_path = index_dir / f"{file_stem}_embeddings.npy"

        if index_path.exists() and embeddings_path.exists():
            index = faiss.read_index(str(index_path))
            embeddings = np.load(embeddings_path)
            return index, embeddings
        return None, None

class FuzzySearcher:
    """Handles fuzzy text matching"""
    @staticmethod
    def search(df: pd.DataFrame,
              query: str,
              columns: Union[str, List[str]] = None,
              limit: int = 10,
              score_cutoff: int = 60) -> List[Dict]:
        """Perform fuzzy search across specified columns"""
        try:
            if not query:
                return []

            if columns is None:
                columns = df.columns.tolist()
            elif isinstance(columns, str):
                columns = [columns]

            results = []
            perfect_matches = []

            for column in columns:
                if column not in df.columns:
                    logging.warning(f"Column {column} not found in DataFrame")
                    continue

                matches = process.extract(
                    query,
                    df[column].unique(),
                    scorer=fuzz.token_sort_ratio,
                    limit=limit,
                    score_cutoff=score_cutoff
                )

                for match_tuple in matches:
                    match = match_tuple[0]
                    score = match_tuple[1]

                    matching_rows = df[df[column] == match]

                    for _, row in matching_rows.iterrows():
                        result = {
                            'score': score,
                            'matched_column': column,
                            'matched_value': match,
                            'row_data': row.to_dict()
                        }

                        if score == 100:
                            perfect_matches.append(result)
                        else:
                            results.append(result)

            if perfect_matches:
                return perfect_matches[:limit]

            results.sort(key=lambda x: x['score'], reverse=True)
            return results[:limit]

        except Exception as e:
            logging.error(f"Error in fuzzy search: {str(e)}")
            raise

class VectorSearcher:
    """Handles vector similarity search"""
    def __init__(self, embedding_model):
        self.embedding_model = embedding_model

    def search(self,
              query: str,
              index: faiss.Index,
              df: pd.DataFrame,
              top_k: int = 10) -> List[Dict]:
        """Perform vector similarity search"""
        try:
            query_vector = self.embedding_model.encode([query])[0].astype('float32').reshape(1, -1)
            distances, indices = index.search(query_vector, top_k)

            results = []
            for idx, dist in zip(indices[0], distances[0]):
                max_distance = 10
                similarity = max(0, min(100, (1 - dist/max_distance) * 100))

                result = {
                    'score': round(similarity, 2),
                    'matched_type': 'vector',
                    'row_data': df.iloc[idx].to_dict()
                }
                results.append(result)

            return results

        except Exception as e:
            logging.error(f"Error in vector search: {str(e)}")
            raise

class ResultAnalyzer:
    """Analyzes search results using LLM"""
    def __init__(self):
        self.llm_client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

    def analyze(self, query: str, search_results: Dict) -> Dict:
        """Analyze search results to find best match"""
        try:
            results_text = self._format_results(search_results)
            prompt = self._create_prompt(query, results_text)

            response = self.llm_client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You are a search results analyzer. Return only valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0
            )

            return json.loads(response.choices[0].message.content)

        except Exception as e:
            logging.error(f"Error in LLM analysis: {str(e)}")
            raise

    def _format_results(self, search_results: Dict) -> str:
        """Format search results for LLM"""
        results_text = "Fuzzy Matches:\n"
        for i, match in enumerate(search_results['fuzzy_matches'], 1):
            results_text += f"{i}. Score: {match['score']}\n"
            results_text += f"   Column: {match['matched_column']}\n"
            results_text += f"   Matched Value: {match['matched_value']}\n"
            results_text += f"   Data: {json.dumps(match['row_data'], indent=2)}\n\n"

        results_text += "\nVector Matches:\n"
        for i, match in enumerate(search_results['vector_matches'], 1):
            results_text += f"{i}. Score: {match['score']}\n"
            results_text += f"   Data: {json.dumps(match['row_data'], indent=2)}\n\n"

        return results_text

    def _create_prompt(self, query: str, results_text: str) -> str:
        """Create prompt for LLM analysis"""
        return f"""Given this search query: "{query}"

And these search results:

{results_text}

Analyze the results and:
1. Identify the single best matching result
2. Explain why it's the best match
3. Return your response in this JSON format:
{{
    "best_match": {{result object}},
    "match_type": "fuzzy" or "vector",
    "explanation": "your explanation",
    "confidence": "high/medium/low"
}}

Consider both semantic relevance and match scores. If no good match exists, indicate low confidence."""

class FuzzyFirst:
    """Main class that orchestrates the entire search process"""
    def __init__(self, file_path: str):
        self.data_loader = DataLoader(file_path)
        self.vector_indexer = VectorIndexer()
        self.index_manager = IndexManager()
        self.fuzzy_searcher = FuzzySearcher()
        self.vector_searcher = VectorSearcher(self.vector_indexer.embedding_model)
        self.result_analyzer = ResultAnalyzer()

        self.df = self.data_loader.load()
        self.file_stem = Path(file_path).stem

        # Try to load existing index
        self.index, self.embeddings = self.index_manager.load_index(self.file_stem)
        if self.index is None:
            print("No existing index found. Creating new index...")
            self.vector_indexer.create_index(self.df)
            self.index = self.vector_indexer.index
            self.embeddings = self.vector_indexer.embeddings
            self.index_manager.save_index(self.index, self.embeddings, self.file_stem)
        else:
            print("Successfully loaded existing index and embeddings.")

    def smart_search(self,
                    query: str,
                    columns: Union[str, List[str]] = None,
                    fuzzy_limit: int = 10,
                    vector_limit: int = 10,
                    score_cutoff: int = 60) -> str:
        """Perform complete search process and return only the best match"""
        # Get fuzzy search results first
        fuzzy_results = self.fuzzy_searcher.search(
            self.df, query, columns, fuzzy_limit, score_cutoff
        )

        # Check for 100% fuzzy matches
        perfect_matches = [match for match in fuzzy_results if match['score'] == 100]

        # If exactly one perfect match, return it immediately
        if len(perfect_matches) == 1:
            return json.dumps({
                'query': query,
                'best_match': perfect_matches[0],
                'match_type': 'fuzzy',
                'confidence': 'high',
                'explanation': 'Found exact text match with 100% confidence'
            }, indent=2)

        # If multiple perfect matches or no perfect match, proceed with full analysis
        vector_results = self.vector_searcher.search(
            query, self.index, self.df, vector_limit
        )

        # Combine results for analysis
        search_results = {
            'fuzzy_matches': fuzzy_results,
            'vector_matches': vector_results
        }

        # Analyze results
        analysis = self.result_analyzer.analyze(query, search_results)

        # Return the best match and analysis
        return json.dumps({
            'query': query,
            'best_match': analysis['best_match'],
            'match_type': analysis['match_type'],
            'confidence': analysis['confidence'],
            'explanation': analysis['explanation']
        }, indent=2)

# Example usage
if __name__ == "__main__":
    fuzzy = FuzzyFirst("data/price_list/new_pl_cleaned.xlsx")

    print("\nAvailable columns for search:", fuzzy.df.columns.tolist())
    print("\nEnter your search query. The system will search and analyze results to find the best match.")
    print("Type 'exit' to quit.")

    while True:
        query = input("\nEnter your search query (or 'exit' to quit): ").strip()

        if query.lower() == 'exit':
            break

        if not query:
            continue

        try:
            results = fuzzy.smart_search(
                query=query,
                columns=None,
                fuzzy_limit=10,
                vector_limit=10,
                score_cutoff=60
            )
            print("\nAnalyzed Results:")
            print(results)

        except Exception as e:
            print(f"Error processing query: {str(e)}")
import pandas as pd
from typing import Union, List, Dict
import openai
import json
import logging
from pathlib import Path

class ExcelCleaner:
    def __init__(self, api_key: str):
        """Initialize the ExcelCleaner with OpenAI API key."""
        self.api_key = api_key
        
        # Set up logging
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)

    def read_excel_file(self, file_path: Union[str, Path], sheet_name: int = 0) -> pd.DataFrame:
        """
        Read an Excel file and return a DataFrame.
        """
        try:
            df = pd.read_excel(file_path, sheet_name=sheet_name)
            self.logger.info(f"Successfully read Excel file: {file_path}")
            return df
        except Exception as e:
            self.logger.error(f"Error reading Excel file: {str(e)}")
            raise

    def get_sample_data(self, df: pd.DataFrame, num_rows: int = 100) -> str:
        """
        Convert a representative sample of the DataFrame to a string representation.
        """
        head_sample = df.head(num_rows).to_string()
        tail_sample = df.tail(num_rows).to_string()
        
        sample = f"First {num_rows} rows:\n{head_sample}\n\nLast {num_rows} rows:\n{tail_sample}"
        self.logger.info("Preparing sample data for analysis...")
        return sample

    def analyze_headers_with_openai(self, sample_data: str) -> List[str]:
        """
        Use OpenAI to analyze the sample data and identify column headers.
        """
        try:
            client = openai.OpenAI(api_key=self.api_key)
            prompt = f"""
            Analyze the following Excel data carefully and identify ONLY the actual column headers/categories that appear consistently throughout the data.
            
            Important rules:
            1. Only identify headers that are actual columns with data in them
            2. Ignore any metadata or one-off information like company names, phone numbers, or dates that aren't actual columns
            3. Look at both the beginning and end of the data to verify these are consistent columns
            4. Return only a JSON array of the verified column header names
            5. Each header you identify should have actual data under it throughout the file
            
            Data:
            {sample_data}
            """

            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {
                        "role": "system", 
                        "content": """You are a data analyst specializing in identifying true column headers in Excel data.
                        Your task is to identify ONLY headers that represent actual data columns throughout the file.
                        Ignore any metadata, titles, or one-off information that isn't part of the columnar structure.
                        Verify that each header you identify has actual data under it throughout the file."""
                    },
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1
            )

            response_content = response.choices[0].message.content.strip()
            self.logger.info(f"OpenAI Response: {response_content}")

            try:
                start_idx = response_content.find('[')
                end_idx = response_content.rfind(']') + 1
                if start_idx != -1 and end_idx != 0:
                    json_str = response_content[start_idx:end_idx]
                else:
                    json_str = response_content

                headers = json.loads(json_str)
                if not isinstance(headers, list):
                    raise ValueError("Response is not a list")
                
                headers = [h for h in headers if not h.startswith('Unnamed:')]
                
                self.logger.info(f"Successfully identified {len(headers)} actual column headers: {headers}")
                return headers

            except json.JSONDecodeError as je:
                self.logger.error(f"JSON parsing error: {str(je)}")
                self.logger.error(f"Attempted to parse: {response_content}")
                raise

        except Exception as e:
            self.logger.error(f"Error analyzing headers with OpenAI: {str(e)}")
            raise

    def clean_excel_file(self, df: pd.DataFrame, headers: List[str]) -> pd.DataFrame:
        """
        Clean the DataFrame by finding the header row and removing everything else above it.
        """
        try:
            headers_lower = [h.lower().strip() for h in headers]
            
            for idx, row in df.iterrows():
                row_values = [str(val).lower().strip() for val in row.values if pd.notna(val)]
                
                matches = 0
                for header in headers_lower:
                    if any(header in val for val in row_values):
                        matches += 1
                
                match_ratio = matches / len(headers) if headers else 0
                
                if match_ratio > 0.3:
                    clean_df = df.iloc[idx:].reset_index(drop=True)
                    
                    column_mapping = {}
                    for header in headers:
                        for col in clean_df.columns:
                            if any(header.lower() in str(val).lower() 
                                 for val in clean_df[col].head().values if pd.notna(val)):
                                column_mapping[header] = col
                                break
                    
                    if column_mapping:
                        clean_df = clean_df[list(column_mapping.values())]
                        clean_df.columns = list(column_mapping.keys())
                    
                    clean_df = clean_df.dropna(how='all')
                    
                    return clean_df
            
            raise ValueError("Could not find header row in the Excel file")
            
        except Exception as e:
            self.logger.error(f"Error cleaning Excel file: {str(e)}")
            raise

    def process_excel_file(self, file_path: Union[str, Path], sheet_name: int = 0) -> Dict:
        """
        Main method to process an Excel file and return column headers.
        """
        try:
            df = self.read_excel_file(file_path, sheet_name)
            sample_data = self.get_sample_data(df)
            headers = self.analyze_headers_with_openai(sample_data)
            
            return {
                "status": "success",
                "headers": headers,
                "message": "Successfully processed Excel file"
            }
            
        except Exception as e:
            self.logger.error(f"Error processing Excel file: {str(e)}")
            return {
                "status": "error",
                "headers": None,
                "message": str(e)
            }
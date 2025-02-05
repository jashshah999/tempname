# FastAPI Project

## Project Setup

### Prerequisites

- Python 3.9+
- pip (Python package installer)

### Installation

1. Clone the repository:

    ```sh
    git clone <repository-url>
    cd <repository-directory>
    ```

2. Create a virtual environment:

    ```sh
    python -m venv .venv
    ```

3. Activate the virtual environment:

    - On Windows:

        ```sh
        venv\Scripts\activate
        ```

    - On macOS/Linux:

        ```sh
        source venv/bin/activate
        ```

4. Install the required packages:

    ```sh
    pip install -r requirements.txt
    ```

5. Create a `.env` file in the root directory and add the following environment variables:

    ```env
    SUPABASE_URL=<your-supabase-url>
    SUPABASE_KEY=<your-supabase-key>
    HOST=127.0.0.1
    PORT=8000
    SECRET_KEY=<your-secret-key>
    GOOGLE_CLIENT_ID=<your-google-client-id>
    GOOGLE_CLIENT_SECRET=<your-google-client-secret>
    FRONTEND_URL=<your-frontend-url>
    ```

## Running the Project

1. Start the FastAPI application:

    ```sh
    python main.py
    ```

2. Open your browser and navigate to:

    ```sh
    http://localhost:8000
    ```

3. You can access the automatically generated API documentation at:

    ```sh
    http://localhost:8000/docs
    ```

## Project Structure

- `main.py`: The main entry point of the application.
- `resources/database.py`: Contains the Supabase configuration and operations.
- `requirements.txt`: Lists the dependencies required for the project.
- `.env`: Environment variables for the project (not included in the repository).

## License

This project is licensed under the MIT License.
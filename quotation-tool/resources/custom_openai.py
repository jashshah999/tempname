import openai

class GPTProcessor:
    def __init__(self, api_key: str, model: str = "gpt-3.5-turbo"):
        """
        Initializes the GPTProcessor with an OpenAI API key and model.
        :param api_key: OpenAI API key
        :param model: Model to use (default: gpt-3.5-turbo)
        """
        self.api_key = api_key
        self.model = model

    def process_text(self, input_text: str, prompt: str) -> str:
        """
        Sends the input text along with a prompt to OpenAI's GPT API and returns the response.
        :param input_text: The user input text to be processed
        :param prompt: The instruction or prompt to guide GPT
        :return: The processed text from GPT
        """
        openai.api_key = self.api_key
        response = openai.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": input_text}
            ]
        )
        return response.choices[0].message.content.strip()

# Example usage:
if __name__ == "__main__":
    gpt_processor = GPTProcessor(api_key="your-openai-api-key")
    input_text = "Some input text"
    prompt = "Rewrite the text in a formal tone."
    output_text = gpt_processor.process_text(input_text, prompt)
    print(output_text)
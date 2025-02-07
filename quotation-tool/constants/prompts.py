GENERATE_QUOTATION = """
Extract product and company details from the email and output them as JSON. The JSON should include the following fields:

- **companyName**: The recipient company's name mentioned in the email.
- **products**: An array of product objects, each containing:
  - **srNo**: A sequential number starting at 1.
  - **description**: The product description.
  - **make**: The manufacturer's name.
  - **code**: The product code.
  - **range**: The measurement range.
  - **rate**: Leave this field empty for manual entry.
  - **remark**: Any additional remarks.

The output JSON should adhere to the following structure:
```json
{
  "companyName": "extracted company name",
  "products": [
    {
      "srNo": 1,
      "description": "product description",
      "make": "manufacturer name",
      "code": "product code",
      "range": "measurement range",
      "rate": "",
      "remark": "additional remarks"
    }
    // Additional products...
  ]
}
"""
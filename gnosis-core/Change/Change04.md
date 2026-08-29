# TASK PROMPT FOR CLAUDE CODE: MULTI-FILE DOCUMENT UPLOAD & AI CANVAS MERGE ENGINE

## TASK OVERVIEW
Implement a document processing and AI-assisted outline generation workflow within the Books page of `gnosiscore.org`. 

This feature adds a multi-file upload button on the toolbar (placed directly before the Save button). Users can upload PDFs or image files. The application extracts the document text, passes it to an AI engine to structure the content into a `Chapter -> Section -> Details` hierarchy, opens a **Draft Review Canvas** for manual editing, and finally **appends/merges** the generated content into the live book canvas.

---

## IMPLEMENTATION REQUIREMENTS

### 1. UI & File Upload Constraints (Books Page Toolbar)
- **Button Placement & Trigger:**
  - Add an **"Import & Structure with AI"** (📎 / ✨) button to the Books page header toolbar, positioned directly **before** the **Save** button.
- **File Validation Rules:**
  - File Types Supported: **PDF, PNG, JPG/JPEG**.
  - Multi-File Selection: Allow users to select and upload multiple files simultaneously.
  - **Single File Size Limit:** Maximum **4 MB** per file.
  - **Total Batch Size Limit:** Maximum **7 MB** total across all selected files.
  - Implement client-side validation to block uploads exceeding these limits and display a clear toast notification error if violated.

### 2. Text Extraction & Processing Pipeline
- Extract text from uploaded documents (using client/server PDF text parser or OCR for images).
- Combine the extracted text across all uploaded files into a unified processing context payload.

### 3. AI Hierarchy Classification Prompt
- Pass the combined extracted text to the AI model using a structured JSON-enforced system prompt:

```text
You are an expert academic curriculum parser and textbook structure specialist. 
Analyze the provided extracted text from one or more documents and convert it into a well-structured textbook hierarchy.

STRICT STRUCTURAL RULES:
1. Identify macro topics and map them as "Chapter" nodes.
2. Identify logical sub-topics under each chapter and map them as "Section" nodes.
3. Extract detailed explanations, formulas, definitions, and descriptive facts, mapping them as plain-paragraph "Details" nodes beneath the relevant Section or Chapter.

Output ONLY valid JSON matching this schema:
{
  "chapters": [
    {
      "title": "Chapter Title",
      "sections": [
        {
          "title": "Section Title",
          "details": [
            "Detailed explanatory paragraph or concept note."
          ]
        }
      ],
      "direct_details": [
        "Optional chapter-level summary or introduction paragraph."
      ]
    }
  ]
}
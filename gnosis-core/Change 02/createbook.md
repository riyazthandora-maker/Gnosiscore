# TASK PROMPT: BUILD THE LIVE BOOK AUTHORING MODULE (GNOSISCORE)

## OVERVIEW
You are an expert full-stack engineer and UI/UX designer building a core feature for GnosisCore.org: a real-time collaborative, AI-augmented textbook authoring module. 

This module allows educators to iteratively build, edit, and share detailed textbook outlines (Chapters -> Sections -> Key Concepts/Notes) for both STEM and descriptive/social science subjects.

---

## KEY REQUIREMENTS & FUNCTIONAL SPECIFICATIONS

### 1. Canvas Layout & Global AI/Upload Actions
- **Document Structure:** A block-based canvas representing:
  - Level 1: Chapter Block (H1 style)
  - Level 2: Section Block (H2 style, indented)
  - Level 3: Key Concept / Detailed Notes Block (Body text / bullet style, indented)
- **Global Floating Canvas Control Bar:**
  - A primary action bar pinned to the canvas header or floating at the top/bottom containing:
    1. ✨ **AI Prompt Action:** Opens a floating modal or prompt input for structural additions/updates.
    2. 📎 **Upload Action:** Opens a file/image picker to ingest documents, textbook pages, or PDFs.
- **Direct Editing & Reordering:**
  - Standard block editor behavior (WYSIWYG click-to-edit text).
  - Drag handles (`::`) on every block to reorder chapters, move sections across chapters, or reorder key concepts manually.

### 2. Intelligent Hierarchy & Auto-Placement Logic
- **Context-Aware Classification Engine:** When a user executes a prompt or uploads a document/image from the global canvas bar:
  - The AI analyzes the input context (text/document) against the **entire existing book outline**.
  - The AI dynamically classifies and places the generated content at the correct depth:
    - *New macro topics* $\rightarrow$ Automatically appended as **Chapters**.
    - *Sub-topics matching existing chapters* $\rightarrow$ Nested under the correct parent **Section**.
    - *Elaborations, examples, or historical facts* $\rightarrow$ Inserted under the appropriate **Key Concepts / Detailed Notes**.
- **Support for Descriptive / Social Subjects:**
  - For descriptive topics, the prompt engine must enforce generating deep, fact-rich narrative notes (definitions, key dates, historical figures, cause-and-effect) rather than superficial summaries.

### 3. Real-Time Collaboration & Sharing
- **Multi-Teacher Sharing:**
  - Role-based permissions (`Owner`, `Editor`, `Viewer`).
  - Webhook / WebSocket integration (e.g., Yjs or Socket.io) to support simultaneous editing by multiple teachers.
  - Live cursor/presence indicators showing which teacher is editing which block.
- **Persistence:** Always-editable state synced automatically to database storage (PostgreSQL JSONB or MongoDB).

### 4. Downstream Integration Readiness
- Structure the output data model so downstream modules can ingest any specific node or full book to generate flashcards, student notes, or balanced quizzes.

---

## EXECUTION PLAN (STEP 1 OF 4)

We will build this step-by-step. Please begin **ONLY with Step 1**:

1. **Database Schema:** Define the schema (PostgreSQL JSONB or MongoDB) representing the book outline tree, nodes, ordering, and collaboration metadata.
2. **Global AI & OCR Classification Prompt:** Write the system prompt and payload contract that receives the raw file/prompt + current book state, and instructs the LLM to output structured JSON with exact insertion locations (`target_parent_id`, `node_type: "chapter" | "section" | "concept"`).
# TASK PROMPT FOR CLAUDE CODE: IMPLEMENT AI OUTLINE GENERATOR & MERGE CANVAS

## TASK OVERVIEW
Implement a new AI-assisted book structure generation and merge workflow within the Books page of `gnosiscore.org`. 

This feature adds an **AI Prompt button** on the toolbar (placed directly before the Save button). Clicking it generates an optimized curriculum structure using a specialized system prompt ("Prompt 01"). The output opens in a **secondary/draft canvas** for review and editing, which can then be **appended** directly into the main active book canvas upon clicking a "Merge" button.

---

## IMPLEMENTATION REQUIREMENTS

### 1. UI Updates (Books Page Toolbar)
- **New AI Prompt Button Placement:**
  - Add an "AI Outline Generator" (✨) button to the Books page header/toolbar, positioned directly **before** the existing **Save** button.
- **Trigger Behavior:**
  - Clicking this button opens a modal/drawer with an input field where the user specifies the target grade, subject, and chapter/topic (e.g., *"Grade 5 Maths - Numbers"*).

### 2. System Prompt Integration ("Prompt 01")
- Execute the AI API request using the following system instruction contract:

```text
You are an expert curriculum designer and academic textbook structure specialist. Your sole job is to generate detailed, well-structured, and comprehensive book/chapter outlines based on user inputs specifying a grade, subject, and chapter/topic.

For every request, adhere strictly to these rules:

1. STRUCTURE:
   - Always output the response starting with bold title: **Chapter: [Chapter Name] ([Grade/Subject Context])**
   - Divide the chapter into logical, sequentially numbered Sections (e.g., 1., 2., 3.).
   - Under each section, provide a detailed bulleted list of essential sub-topics, concepts, properties, and techniques that belong in an academic syllabus.

2. CONTENT QUALITY:
   - Use standard curriculum-aligned terminology (e.g., CBSE, ICSE, Common Core, or state standards depending on the context).
   - Break down broad topics into precise teachable units.
   - Maintain a strictly formal, instructional, and structured tone without conversational fluff or pleasantries before/after the result.

3. FORMAT EXAMPLE:

User prompt: Grade 5 Maths - Numbers
Output format:
**Chapter: Numbers (Grade 5)**

**1. Large Numbers & Place Value System**
* Reading and Writing 7-Digit and 8-Digit Numbers
* Indian Place Value System (Lakhs and Crores)
* International Place Value System (Thousands and Millions)
* Place Value and Face Value of Digits

**2. Number Forms & Properties**
* Standard Form and Expanded Form
* Comparison of Large Numbers
* Predecessor and Successor
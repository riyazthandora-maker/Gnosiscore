# TASK PROMPT FOR CLAUDE CODE: IMPLEMENT EXAM GENERATION WORKFLOW

## TASK OVERVIEW
Implement a multi-step "Generate Exam/Questions" wizard in `gnosiscore.org`. This module allows teachers to select syllabus content from their books, define difficulty weightings, generate AI-powered multiple-choice questions with math support, review/edit the output, and print or save the final question paper. 

**Global Requirement:** The entire operation must be fully compatible with mobile devices, ensuring touch-friendly interactions and responsive layouts across all workflow steps.

---

## WORKFLOW UI & IMPLEMENTATION REQUIREMENTS

### Step 1: Content Selection (File Explorer UI)
- **Component:** A searchable, hierarchical tree-view (Folder Explorer style) displaying the user's Books -> Chapters -> Sections.
- **Interactions:**
  - Search bar to filter nodes by text.
  - Multi-select capability with cascading checkboxes (checking a Chapter selects all its Sections).
  - Users can select across multiple different books.
- **Mobile UX:** Ensure the tree hierarchy is easily navigable on small screens with adequate touch targets for expansion and checkboxes.

### Step 2: Weightage Distribution
- **Component:** A distribution table listing only the nodes (Books/Chapters/Sections) selected in Step 1.
- **Logic:**
  - Auto-calculate and display a default **evenly distributed weightage percentage** across the selected items.
  - Make the weightage input fields manually editable so teachers can adjust the focus (ensure total validation equals 100% or relative fractions).
- **Mobile UX:** Convert the distribution table into a stacked card layout or responsive grid for mobile viewports.

### Step 3: Exam Settings
- **Total Questions:** 
  - Provide a drag slider (Range: 1 to a maximum of 20 questions).
- **Difficulty Split:** 
  - Provide a secondary slider or dual-input to divide the total questions into Easy and Hard.
  - **Default state:** 90% Easy, 10% Hard.
- **Mobile UX:** Ensure drag sliders are touch-optimized and do not conflict with native page scrolling.

### General AI & Backend Rules (Enforce in LLM Prompt)
- **Randomization:** The AI must randomize the correct answer position roughly equally across options A, B, C, and D.
- **Math Notations:** The system must fully support complex mathematical notations (using LaTeX enclosed in $ for inline and $$ for block math).
- **Explanations:** The AI must generate and store a 1-to-2 sentence educational explanation for why the correct answer is right for every question.

### Step 4: Editor & Preview Screen
- **Question Editor UI:**
  - Render the generated questions in an editable list.
  - Teachers can edit the question text and answer options inline.
  - Drag-and-drop to reorder the answer options (A/B/C/D).
  - Dropdown/Radio toggle to manually change which option is marked as correct.
- **Math Verification Panel:** 
  - Provide a live, read-only rendering area (using KaTeX or MathJax) next to or below the edit fields so teachers can visually confirm that complex mathematical notations are rendering correctly as they edit the raw text.
- **Mobile UX:** Implement touch-based drag-and-drop for reordering and ensure side-by-side math previews stack vertically on mobile screens.

### Step 5: Print Preview Screen
- **Print Layout:** A clean, printable document view formatted like a standard academic question paper.
- **Toggles:** A toggle switch to print **"With Answers & Explanations"** (Teacher Copy) or **"Without Answers"** (Student Copy). Use CSS `@media print` rules to hide UI elements during printing.

### Step 6: Naming & Final Save
- **AI Name Suggestion:** Send the generated questions to a lightweight AI endpoint to auto-suggest a logical title for the exam (e.g., "Fractions and Decimals Quiz").
- **Uniqueness & Timestamping:** 
  - Automatically append the current Date & Time to the suggested name to guarantee uniqueness.
  - Validate that the final name is completely unique for the logged-in user.
- **Final Save:** A primary "Save Question Paper" button that persists the document to the database.

### Dashboard / Listing View Updates
- Ensure the saved question papers appear in a dashboard list.
- Provide a search bar allowing the user to search past generated exams by **Name** or **Creation Date**.

---

## REQUIRED CODE DELIVERABLES
1. **Wizard State Manager:** A React context or state machine managing the payload across the 6 steps, keeping responsive state in mind.
2. **Step 1 & 2 UI:** The mobile-friendly tree-view checkbox component and the responsive weightage calculator grid.
3. **AI Generation Pipeline:** The backend API route invoking the LLM with the strict A-D randomization, LaTeX math, and explanation constraints.
4. **Step 4 Editor Component:** The interactive question editor with KaTeX/MathJax read-only live preview and touch-enabled drag-and-drop.
5. **Print & Naming Logic:** The CSS print layout implementation and the AI naming endpoint with timestamp appending.
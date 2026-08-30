# TASK PROMPT FOR CLAUDE CODE: ADD GENERAL INSTRUCTIONS FOR AI QUESTION GENERATION

## TASK OVERVIEW
Update the Step 1 (Content Selection) workflow of the Exam Generation module in `gnosiscore.org` to include an optional "General Instructions" text field. 

This feature allows teachers to dictate the specific nature, cognitive depth, or format of the generated questions (e.g., "JEE past papers", "NEET style", or "Application level questions"). This instruction must be captured in the wizard state and injected directly into the LLM system prompt during generation.

---

## IMPLEMENTATION REQUIREMENTS

### 1. UI Updates (Step 1: Content Selection)
- **Component Addition:** 
  - Add a standard text input field or text area directly below the Books/Chapters tree-view component.
  - **Label:** "General Instructions (Optional)"
  - **Placeholder text:** *"e.g., JEE past papers, NEET style, Application level questions..."*
- **Responsive Design:** 
  - Ensure the input field is fully fluid, touch-optimized, and styled consistently with the existing UI for mobile and desktop viewports.

### 2. State Management Updates
- **Wizard State Object:**
  - Introduce a new string field named `general_instruction` (default to an empty string `""`) in the global workflow state/context.
  - Ensure this value persists securely as the user navigates forward to the Weightage/Exam Settings screens and backward to the Content screen.

### 3. Backend API & AI Pipeline Integration
- **API Payload Update:**
  - Update the backend generation endpoint (e.g., `POST /api/generate-questions`) to accept the `general_instruction` string parameter.
- **System Prompt Injection:**
  - Update the LLM prompt construction logic to conditionally append a style directive if `general_instruction` is provided.
  - **Prompt Addition Structure:** 
    ```text
    Style Directive: Ensure the nature, cognitive depth, and format of these questions strictly align with the following instruction: [{general_instruction}].
    ```
  - **Constraint Protection:** Ensure the injection of this directive does NOT override the strict functional rules already established in the prompt (e.g., strict JSON formatting, exactly one correct answer, A-D randomization, and LaTeX `$` or `$$` math support).

---

## REQUIRED CODE DELIVERABLES
1. **Frontend UI Update:** The modified Step 1 component containing the new text input/area and updated layout.
2. **State Manager Update:** The updated React context, Redux store, or local state hook that manages the `general_instruction` payload across steps.
3. **Backend Prompt Logic:** The updated API route demonstrating how the `general_instruction` is parsed from the request body and securely formatted into the outgoing LLM system prompt without breaking existing structural constraints.
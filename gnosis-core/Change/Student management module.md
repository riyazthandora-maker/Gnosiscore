# TASK PROMPT FOR CLAUDE CODE: IMPLEMENT STUDENT MANAGEMENT MODULE

## TASK OVERVIEW
Implement a fully responsive **Student Management** page within `gnosiscore.org` designed for teachers and parents. 

This module allows teachers to add, view, search, edit, and manage student profiles. Key capabilities include a dynamic/customizable grade dropdown, unique student email enforcement per teacher, grade renaming capabilities across all assigned students, and full mobile optimization.

---

## IMPLEMENTATION REQUIREMENTS

### 1. Data Schema & Model Definitions
- **Student Entity:**
  - `id`: Unique identifier (UUID).
  - `teacher_id`: Foreign key referencing the logged-in teacher.
  - `name`: String (Required).
  - `phone`: String (Optional/Required, formatted phone string).
  - `email`: String (Required, unique per `teacher_id`).
  - `grade_id`: Foreign key referencing the Grade entity.
  - `created_at` & `updated_at`: Timestamps.
- **Grade Entity:**
  - `id`: Unique identifier.
  - `teacher_id`: Foreign key referencing the teacher.
  - `name`: String (e.g., "Grade 5", "Grade 6", "Advanced Math").
- **Constraints & Validation:**
  - **Email Uniqueness:** Enforce a composite unique constraint on `(teacher_id, email)`. If a teacher tries to add or edit a student with an email that already exists in their student list, reject with a user-friendly error message.
  - **Validation Rules:** Validate proper email syntax and phone number formatting.

### 2. Custom Editable Grade Dropdown Component
- **Behavior:**
  - Standard dropdown listing all existing grades created by or assigned to the teacher.
  - **Inline Creation:** The component acts as a combobox/creatable select. If a teacher types a new grade name (e.g., "Grade 7 - Honors") that does not exist in the list:
    1. Show a **"+ Add '[New Grade Name]'"** option at the top or bottom of the dropdown list.
    2. Selecting this automatically creates the new Grade entry in the database and assigns it to the student.
    3. The newly created grade is immediately added to the teacher's master grade list for future selection.

### 3. Student Details & Editing Flow
- **Data Table / Card View:**
  - Display students in a structured list with Search & Filter controls (filter by Grade, search by Name/Email).
  - Include inline or modal-based **"Edit Student"** action for every row.
- **Editable Fields:**
  - Teachers can update Name, Phone, Email, and Grade at any time.
  - Re-validate email uniqueness upon save (ignoring the current student's own record).

### 4. Grade Management & Bulk Renaming Logic
- **Global Grade Renaming:**
  - Provide a Grade Management setting/modal allowing teachers to rename existing grades (e.g., rename "Grade 5" to "Grade 5-A").
  - **Cascading Update:** Renaming a grade automatically updates the grade label across all students assigned to that grade.

### 5. Responsive & Mobile UI/UX Design
- **Mobile-First Layout:**
  - **Desktop:** Multi-column Data Table with quick-action icons.
  - **Mobile (< 768px):** Automatically convert table rows into clean, touch-friendly Student Cards displaying key actions (Edit, Call/Email shortcuts).
  - Sticky bottom or top action bar for the **"Add New Student"** trigger on smaller screens.
- **Touch-Friendly Controls:**
  - Ensure all form inputs, dropdowns, and buttons satisfy touch target guidelines (minimum 44x44px).

---

## REQUIRED CODE DELIVERABLES

1. **Database Migration / Schema File:** PostgreSQL/Prisma/TypeORM schema definitions for `Student` and `Grade` models with composite unique indices.
2. **API Routes / Backend Controllers:**
   - `GET /api/students` (List with filters/search)
   - `POST /api/students` (Create student + handle dynamic grade creation)
   - `PUT /api/students/:id` (Update student details)
   - `PATCH /api/grades/:id` (Rename grade and cascade updates)
3. **Frontend Components (React / TypeScript / Tailwind CSS):**
   - Main `StudentManagementPage` layout.
   - `CreatableGradeSelect` component (combobox supporting inline grade addition).
   - `StudentFormModal` for creating/editing student records.
   - Mobile-responsive Student Card & Table view toggle.
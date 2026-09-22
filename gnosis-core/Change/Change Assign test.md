# TASK PROMPT FOR CLAUDE CODE: IMPLEMENT "ASSIGN TEST" MODULE (PHASED APPROACH)

## TASK OVERVIEW
Implement a new **"Assign Test"** page within `gnosiscore.org` to allow educators to distribute generated exams to students. This module includes multi-select test and student assignment workflows, paired with a comprehensive exam configuration engine covering timing, delivery, navigation, security, and result feedback. 

Please implement this feature in the following distinct phases to ensure stability and proper state management.

---

## PHASE 1: DATA SCHEMA & SELECTION UI

### 1. Database Schema Update
- Create `Assignment`, `ExamConfiguration`, and `ExamSession` data models (Prisma/TypeORM) supporting all configuration fields, defaults, and many-to-many relationships (Test IDs $\leftrightarrow$ Student IDs).

### 2. Assignment Selection UI
- **Test Selection Panel:**
  - Display a searchable list of available exams/tests.
  - Implement multi-select capability (checkboxes) allowing teachers to assign one or more tests simultaneously.
- **Student Selection Explorer:**
  - Implement a hierarchical tree-view (Grade Level $\rightarrow$ Students).
  - Include cascading selection: checking a Grade automatically selects all students nested beneath it.
  - Support multi-select across different grades.

---

## PHASE 2: EXAM CONFIGURATION ENGINE

Construct a configuration form divided into the following functional sections with specific default states:

### 1. Timing & Access
- **Exam Duration:** Input for total minutes. Default: **20 minutes**. (Requires frontend countdown timer and auto-submit logic on expiration).
- **Availability Window:** Date/time pickers for Start and End. Default: **No limits** (Always active).
- **Attempt Limits:** Numeric input restricting retakes. Default: **3 attempts**.

### 2. Question & Answer Delivery
- **Randomize Question Order:** Toggle switch to shuffle question sequence per student.
- **Shuffle Answer Options:** Toggle switch to randomize A/B/C/D option order to prevent answer sharing.

### 3. Navigation & Control
- **Allow Backtracking:** Toggle to permit returning to previous questions. Default: **Yes**.
- **Mandatory Answering:** Toggle to prevent moving to the next page without answering. Default: **No**.
- **Flag for Review:** Toggle to enable a bookmarking feature for students to mark unsure questions before final submission.

### 4. Security & Anti-Cheating (Best Effort)
- **Browser Lockdown:** Toggle to force full-screen mode (HTML5 Fullscreen API). *Fallback:* If the browser rejects, log the attempt but allow the exam to proceed.
- **Disable Copy/Paste/Print:** Toggle to block `copy`, `paste`, `contextmenu`, and use CSS rules to hide content during `@media print`.
- **Tab-Switch Warnings:** Toggle to utilize the Document `visibilitychange` API. Log infractions or auto-terminate after a threshold. *Fallback:* Ignore if unsupported.

### 5. Results & Feedback
- **Release Results Immediately:** Toggle to display final score upon submission. Default: **Yes**.
- **Show Explanations:** Toggle to display pre-written rationales post-submission.
- **Pass/Fail Thresholds:** Editable grading bands. Default: **90%** (Excellent), **80%** (Distinction), **70%** (Pass), **Below 70%** (Failed).

---

## PHASE 3: WORKFLOW MECHANICS & STATE MANAGEMENT

### 1. Exam Lobby
- Before the timer begins, students must land on a "Lobby Screen" displaying exam instructions, configuration details (time limit, attempts, security warnings), and a "Start Exam" button.

### 2. Attendance & State Tracking
- **Attendance Trigger:** The exam attempt status transitions to "Attended" (or "In-Progress") the moment the student clicks start and lands on the first question.
- **Pause & Resume:** If permitted, students can stop/exit the exam and resume later. The countdown timer must accurately calculate elapsed time upon return.
- **Auto-Submission Logic:** If a student abandons the exam or time expires before manual submission, the system must perform an "Auto-Submit" to sweep saved answers, grade them, and close the attempt.

---

## PHASE 4: NOTIFICATION SYSTEM

### 1. Automated Email Triggers
- **Student Assignment Email:** Trigger an email to the student when a new test is assigned, containing a direct link to the Lobby Screen.
- **Teacher Submission Email:** Trigger an email back to the teacher whenever a student's exam is successfully submitted (either manually by the student or via auto-submit).

---

## REQUIRED CODE DELIVERABLES
1. **Schema Definitions:** Updated database schema for Assignments, Configurations, and Sessions.
2. **Assignment Components:** React components for the Test List (with search) and the Student Grade Explorer tree.
3. **Configuration Form:** The settings form containing the sub-sections and mapped default values.
4. **Security Hook:** A React hook (`useExamSecurity`) implementing the Fullscreen API, visibility tracking, and copy/paste prevention.
5. **Session Manager:** Backend and frontend logic handling the Lobby, Pause/Resume timer, and Auto-Submit triggers.
6. **Notification Services:** API routes handling the assignment and submission email dispatch.
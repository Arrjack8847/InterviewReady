# InterviewReady AI — Smart Interview Preparation Platform

An AI-assisted interview preparation web application designed to help students and job seekers practise interviews, organise their preparation, and review feedback through a structured digital experience.

## Live Demo

[View the live project](https://interview2-alpha.vercel.app/)

## Overview

InterviewReady AI is a web-based interview preparation platform that focuses on making interview practice more structured and less stressful.

The project is designed around a guided interview workflow where users can prepare for a target role, work through practice questions, and review performance-oriented feedback. It combines a modern frontend interface with foundations for document processing, visual analysis, feedback reporting, and data-driven interview preparation.

## Product Scope

InterviewReady AI is designed to support:

* Role-specific interview preparation
* Company and job-position focused practice
* Resume or PDF document upload workflows
* Mock interview question-and-answer sessions
* Feedback and performance review interfaces
* Interview progress and score visualisation
* Future text, voice, and video interview support
* Computer-vision based interview analysis foundations

## Features

* Responsive user interface for desktop and mobile devices
* Structured interview-preparation experience
* Candidate-focused interview workflow
* Resume and document-processing support
* Interactive forms for interview setup and preparation
* Feedback-oriented dashboard layout
* Data visualisation components for performance reporting
* Modern reusable React component architecture
* UI components for dialogs, tabs, progress indicators, forms, and notifications

## Tech Stack

* React
* TypeScript
* Vite
* TanStack Router
* TanStack Query
* Tailwind CSS
* Supabase
* React Hook Form
* Zod
* Recharts
* MediaPipe Tasks Vision
* PDF Parse
* Lucide React
* Vercel

## Project Structure

```text
src/
  components/       # Reusable user interface components
  routes/           # Application routes and pages
  hooks/            # Reusable React hooks
  lib/              # Shared utilities and configuration
  integrations/     # External service integrations
  styles/           # Global styles and Tailwind configuration
public/             # Static assets
```

> Folder names may differ slightly depending on the current version of the project.

## Local Setup

Clone the repository:

```bash
git clone https://github.com/Arrjack8847/interview2.git
cd interview2
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the local development site in your browser:

```text
http://localhost:5173
```

## Available Scripts

```bash
npm run dev       # Start the Vite development server
npm run build     # Create a production build
npm start         # Run the built Nitro Node server
npm run build:dev # Create a development-mode build
npm run preview   # Preview the production build locally
npm run lint      # Run ESLint
npm run format    # Format project files with Prettier
```

## Deployment

The project is deployed using Vercel.

[Open the deployed website](https://interview2-alpha.vercel.app/)

## Screenshots

Add screenshots of these sections when available:

* Landing page
* Interview setup flow
* Resume upload interface
* Practice interview screen
* Feedback or results dashboard
* Mobile layout

Example:

```md
![InterviewReady AI homepage](./public/screenshots/homepage.png)
```

## Future Improvements

* Connect a production AI model for personalised feedback
* Add secure authentication and user profiles
* Save interview history and progress reports
* Improve resume analysis and role matching
* Add voice-based interview practice
* Add webcam-based visual feedback where appropriate
* Export interview feedback reports

## What I Learned

* Building a structured multi-step user workflow with React and TypeScript
* Creating responsive interfaces with Tailwind CSS
* Managing application routes with TanStack Router
* Designing form validation workflows using React Hook Form and Zod
* Preparing an application for document processing, data visualisation, and AI-assisted feedback
* Organising a modern frontend project for deployment with Vercel

## Author

**Soe Min Khant**

* GitHub: [Arrjack8847](https://github.com/Arrjack8847)
* Portfolio: [JackNex Studio](https://jack-nex-studio.vercel.app/)

---

This project is part of my frontend, AI-assisted development, and digital product portfolio.

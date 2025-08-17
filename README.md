# Planner

A simple web-based planner to visualize the agenda and track all actions that students must complete in parallel during a seven-week course.

## Objective

The planner helps students stay organized by laying out tasks week by week. It displays multiple activities in parallel, making it easy to track overlapping assignments, group projects, and key milestones across the entire seven-week session.

## Technology

- **React 18** renders the interactive timeline interface directly in the browser.
- **Tailwind CSS** provides utility classes for quick styling and layout.
- **Supabase** offers a lightweight backend to persist tasks and categories.
- **Babel** transpiles JSX on the fly so that the app can be served as a simple static page.

All client-side dependencies are loaded from CDNs, allowing the planner to run without a build step.

## Usage

1. Open `docs/index.html` in a modern browser.
2. Add categories and tasks to build the timeline.
3. Drag tasks across the weeks to adjust scheduling. Notes can be attached to tasks for additional context.

Because the app is entirely static, it can be hosted on any static file server (such as GitHub Pages) by serving the `docs/` directory.


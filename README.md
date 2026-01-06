# RAG-Sandbox

Multi-tenant Agentic RAG Platform.

## Features
- **Data Ingestion**: Upload PDF, CSV, TXT, JSON, DOCX.
- **Embedding**: Uses Supabase Edge Functions with `Supabase/gte-small` (via `transformers.js`).
- **Vector Store**: Supabase `pgvector`.
- **Frontend**: Next.js 14 + Tailwind CSS.

---

## 🌐 Website Preview

### Landing Page
![Landing Page Preview](./images/website-preview-1.png)

### Document Upload & Processing
![Document Processing](./images/website-preview-2.png)

### RAG Query Interface
![Query Interface](./images/website-preview-3.png)

---

## 🔌 API Testing (Postman)

### Request Handling
![Postman Request Handling](./images/postman-request-handling.png)

### API Demo
![Postman API Demo](./images/postman.gif)

> **Note**: The GIF above demonstrates the complete API workflow including file upload, processing, and querying through Postman.

---

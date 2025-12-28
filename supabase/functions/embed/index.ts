
import { pipeline, env } from 'https://esm.sh/@xenova/transformers@2.17.2';

// Configuration for Supabase Edge Functions
env.useBrowserCache = false;
env.allowLocalModels = false;
env.cacheDir = '/tmp'; // Use tmp for model cache

const modelId = "Supabase/gte-small";

class EmbeddingPipeline {
  static task = "feature-extraction";
  static model = modelId;
  static instance = null;

  static async getInstance() {
    if (this.instance === null) {
      console.log(`Loading model ${this.model}...`);
      this.instance = await pipeline(this.task, this.model);
      console.log("Model loaded!");
    }
    return this.instance;
  }
}

Deno.serve(async (req) => {
  try {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
    }

    if (!req.body) {
      return new Response(JSON.stringify({ error: "No request body provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { input } = await req.json();

    if (!input) {
      return new Response(JSON.stringify({ error: "Input is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const extractor = await EmbeddingPipeline.getInstance();
    const output = await extractor(input, { pooling: "mean", normalize: true });
    const embedding = Array.from(output.data);

    return new Response(JSON.stringify({ embedding }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating embedding:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface Board { id: string; titulo: string; descricao?: string | null }
interface Column { id: string; titulo: string }
interface Task { id: string; titulo: string; descricao?: string | null; prioridade: 'baixa'|'media'|'alta'; data_entrega?: string | null; column_id: string }

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey, x-supabase-api-key",
  "Access-Control-Allow-Credentials": "true",
};

async function embed(input: string, apiKey: string): Promise<number[]> {
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      content: {
        parts: [{ text: input }]
      }
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error: ${res.status} ${err}`);
  }

  const json = await res.json();
  const vec = json?.embedding?.values;
  if (!Array.isArray(vec)) throw new Error("Embedding not returned");
  return vec as number[];
}

function textForBoard(board: Board) {
  return `Board: ${board.titulo}\nDescricao: ${board.descricao ?? ''}`.trim();
}

function textForColumn(board: Board, column: Column) {
  return `Coluna: ${column.titulo}\nBoard: ${board.titulo}`;
}

function textForTask(board: Board, column: Column, task: Task) {
  const due = task.data_entrega ? new Date(task.data_entrega).toISOString().slice(0,10) : '';
  return [
    `Tarefa: ${task.titulo}`,
    task.descricao ? `Descricao: ${task.descricao}` : undefined,
    `Prioridade: ${task.prioridade}`,
    due ? `Entrega: ${due}` : undefined,
    `Coluna: ${column.titulo}`,
    `Board: ${board.titulo}`,
  ].filter(Boolean).join('\n');
}

function jsonContent(obj: any) {
  return JSON.stringify(obj);
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: { ...corsHeaders } });
    }

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const { board_id } = await req.json();
    if (!board_id) {
      return new Response(JSON.stringify({ success: false, error: 'Missing board_id' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ success: false, error: 'Supabase service role not configured' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    // Note: GEMINI_API_KEY is optional for testing - will use dummy vectors if not available

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: board, error: boardErr } = await supabase
      .from('boards')
      .select('id,titulo,descricao')
      .eq('id', board_id)
      .single();
    if (boardErr || !board) throw new Error(boardErr?.message || 'Board not found');

    const { data: columns, error: colErr } = await supabase
      .from('columns')
      .select('id,titulo')
      .eq('board_id', board_id)
      .order('posicao');
    if (colErr) throw new Error(colErr.message);

    const columnIds = (columns || []).map(c => c.id);
    const { data: tasks, error: taskErr } = await supabase
      .from('tasks')
      .select('id,titulo,descricao,prioridade,data_entrega,column_id')
      .in('column_id', columnIds.length ? columnIds : ['00000000-0000-0000-0000-000000000000'])
      .order('posicao');
    if (taskErr) throw new Error(taskErr.message);

    const items: Array<{ content: string; text: string }> = [];

    // Board
    items.push({
      content: jsonContent({ type: 'board', board_id, titulo: board.titulo, descricao: board.descricao ?? null }),
      text: textForBoard(board as Board),
    });

    // Columns
    for (const col of (columns || [])) {
      items.push({
        content: jsonContent({ type: 'column', board_id, coluna_titulo: (col as Column).titulo }),
        text: textForColumn(board as Board, col as Column),
      });
    }

    // Tasks
    const colMap = new Map((columns || []).map(c => [c.id, c]));
    for (const t of (tasks || [])) {
      const col = colMap.get(t.column_id);
      if (!col) continue;
      items.push({
        content: jsonContent({ type: 'task', board_id, coluna_titulo: (col as Column).titulo, titulo: (t as Task).titulo, descricao: (t as Task).descricao ?? null, prioridade: (t as Task).prioridade, data_entrega: (t as Task).data_entrega ?? null }),
        text: textForTask(board as Board, col as Column, t as Task),
      });
    }

    // Delete previous vectors
    const { error: delErr } = await supabase
      .from('board_vectors')
      .delete()
      .eq('board_id', board_id);
    if (delErr) throw new Error(delErr.message);

    // Insert new vectors
    const rows: Array<{ board_id: string; content: string; embedding: number[] }> = [];
    for (const item of items) {
      // Temporary: use dummy vector if Gemini key is not available
      let vec: number[];
      if (GEMINI_API_KEY) {
        vec = await embed(item.text, GEMINI_API_KEY);
      } else {
        // Create a dummy 768-dimensional vector (all zeros for now) - text-embedding-004 uses 768 dimensions
        vec = new Array(768).fill(0);
      }
      rows.push({ board_id, content: item.content, embedding: vec });
    }

    const { error: insErr } = await supabase
      .from('board_vectors')
      .insert(rows);
    if (insErr) throw new Error(insErr.message);

    return new Response(JSON.stringify({ success: true, total: rows.length }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e?.message || String(e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});
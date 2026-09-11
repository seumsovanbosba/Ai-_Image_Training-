import { StylePreset, ResolutionPreset, ModelInfo, LoraInfo, Board, ImageAsset, SystemStatus } from '../types';

const BASE_URL = '/api';

async function handleResponseError(res: Response): Promise<never> {
  let errText = await res.text();
  try {
    const parsed = JSON.parse(errText);
    if (parsed.detail) {
      errText = typeof parsed.detail === 'string' ? parsed.detail : JSON.stringify(parsed.detail);
    }
  } catch {}
  throw new Error(errText);
}

export const api = {
  async getModels(): Promise<ModelInfo[]> {
    const res = await fetch(`${BASE_URL}/models`);
    return res.json();
  },

  async getLoras(): Promise<LoraInfo[]> {
    const res = await fetch(`${BASE_URL}/loras`);
    if (!res.ok) return [];
    return res.json();
  },

  async getStyles(): Promise<StylePreset[]> {
    const res = await fetch(`${BASE_URL}/styles`);
    return res.json();
  },

  async getResolutions(): Promise<ResolutionPreset[]> {
    const res = await fetch(`${BASE_URL}/resolutions`);
    return res.json();
  },

  async getSystemStatus(): Promise<SystemStatus> {
    const res = await fetch(`${BASE_URL}/system/status`);
    return res.json();
  },

  async startEngine(): Promise<{ status: string; comfyui_online: boolean; message?: string }> {
    const res = await fetch(`${BASE_URL}/system/start-engine`, { method: 'POST' });
    return res.json();
  },

  async generate(data: any): Promise<{ task_id: string; seed: number; processed_prompt: any }> {
    const res = await fetch(`${BASE_URL}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) await handleResponseError(res);
    return res.json();
  },

  async inpaint(data: any): Promise<{ task_id: string; seed: number; processed_prompt: any }> {
    const res = await fetch(`${BASE_URL}/inpaint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) await handleResponseError(res);
    return res.json();
  },

  async img2img(data: any): Promise<{ task_id: string; seed: number; processed_prompt: any; denoise?: number }> {
    const res = await fetch(`${BASE_URL}/img2img`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) await handleResponseError(res);
    return res.json();
  },

  async upscale(data: any): Promise<{ task_id: string; seed: number; target_width: number; target_height: number }> {
    const res = await fetch(`${BASE_URL}/upscale`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) await handleResponseError(res);
    return res.json();
  },

  async interrupt(): Promise<{ status: string; interrupted: boolean }> {
    const res = await fetch(`${BASE_URL}/interrupt`, { method: 'POST' });
    return res.json();
  },

  async getImages(boardId?: number): Promise<ImageAsset[]> {
    const url = boardId !== undefined ? `${BASE_URL}/images?board_id=${boardId}` : `${BASE_URL}/images`;
    const res = await fetch(url);
    return res.json();
  },

  async deleteImage(id: number): Promise<void> {
    await fetch(`${BASE_URL}/images/${id}`, { method: 'DELETE' });
  },

  async deleteImagesBatch(imageIds: number[]): Promise<void> {
    if (!imageIds.length) return;
    await fetch(`${BASE_URL}/images/delete-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_ids: imageIds }),
    });
  },


  async getBoards(): Promise<Board[]> {
    const res = await fetch(`${BASE_URL}/boards`);
    return res.json();
  },

  async createBoard(name: string, description?: string): Promise<Board> {
    const res = await fetch(`${BASE_URL}/boards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async assignImageBoard(imageId: number, boardId: number | null): Promise<void> {
    const query = boardId !== null ? `?board_id=${boardId}` : '';
    await fetch(`${BASE_URL}/images/${imageId}/board${query}`, { method: 'PATCH' });
  }
};

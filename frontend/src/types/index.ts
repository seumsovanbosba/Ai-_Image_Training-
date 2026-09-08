export interface StylePreset {
  name: string;
  category: string;
  positive_prompt: string;
  negative_prompt: string;
}

export interface ResolutionPreset {
  width: number;
  height: number;
  label: string;
  aspect_ratio: string;
  target: string;
}

export interface ModelInfo {
  name: string;
  path: string;
  type: 'sdxl' | 'flux' | 'sd15' | string;
  size_gb: number;
}

export interface Board {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  image_count: number;
}

export interface ImageAsset {
  id: number;
  filename: string;
  filepath: string;
  url: string;
  prompt: string;
  negative_prompt?: string;
  styles_applied: string[];
  model_name: string;
  sampler: string;
  scheduler: string;
  steps: number;
  cfg_scale: number;
  seed: number;
  width: number;
  height: number;
  is_inpaint: boolean;
  board_id?: number | null;
  created_at: string;
}

export interface TaskProgress {
  type: 'start' | 'progress' | 'preview' | 'completed' | 'failed' | 'interrupted' | 'ping';
  status?: string;
  current_step?: number;
  total_steps?: number;
  progress?: number;
  preview_base64?: string;
  output_images?: string[];
  error?: string;
}

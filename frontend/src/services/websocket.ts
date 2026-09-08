import { TaskProgress } from '../types';

export class ProgressWebSocket {
  private ws: WebSocket | null = null;
  private taskId: string;
  private onMessage: (progress: TaskProgress) => void;
  private onError?: (err: any) => void;
  private onComplete?: () => void;

  constructor(
    taskId: string,
    onMessage: (progress: TaskProgress) => void,
    onComplete?: () => void,
    onError?: (err: any) => void
  ) {
    this.taskId = taskId;
    this.onMessage = onMessage;
    this.onComplete = onComplete;
    this.onError = onError;
    this.connect();
  }

  private connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = `${protocol}//${host}/api/progress/${this.taskId}`;

    this.ws = new WebSocket(url);

    this.ws.onmessage = (event) => {
      try {
        const data: TaskProgress = JSON.parse(event.data);
        if (data.type === 'ping') return;
        this.onMessage(data);

        if (data.type === 'completed' || data.type === 'failed' || data.type === 'interrupted') {
          if (this.onComplete) this.onComplete();
          this.close();
        }
      } catch (e) {
        console.error('Failed to parse WebSocket progress payload', e);
      }
    };

    this.ws.onerror = (err) => {
      if (this.onError) this.onError(err);
    };

    this.ws.onclose = () => {
      // Clean disconnect
    };
  }

  public close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

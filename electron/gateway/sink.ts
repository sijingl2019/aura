import type { StreamEvent } from '@shared/types';
import type { OutboundReply } from './types';

const FLUSH_INTERVAL_MS = 1000;

/**
 * Converts the agent's fine-grained StreamEvent flow into throttled message
 * updates suitable for an IM platform (which wants whole-message edits, not
 * per-token pushes). Text deltas accumulate; the buffer is rendered at most
 * once per FLUSH_INTERVAL_MS, with a final render on `done`.
 */
export class GatewaySink {
  private text = '';
  private toolNote = '';
  private lastFlush = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private rendering = false;
  private dirty = false;
  private finished = false;
  private errorMessage: string | null = null;

  constructor(private readonly reply: OutboundReply) {}

  /** Feed a StreamEvent from runtime.run(). Returns a Promise that resolves
   *  once the terminal (done/error) render has been flushed. */
  readonly handle = (ev: StreamEvent): void => {
    switch (ev.type) {
      case 'text':
        this.text += ev.delta;
        this.scheduleFlush();
        break;
      case 'tool_call_start':
        // Show a transient status only while we have nothing else to display.
        if (!this.text) {
          this.toolNote = `🔧 正在调用工具 ${ev.name}…`;
          this.scheduleFlush();
        }
        break;
      case 'tool_result':
        // Clear the transient note once the tool returns and text starts flowing.
        if (this.toolNote && this.text) this.toolNote = '';
        break;
      case 'error':
        this.errorMessage = ev.message;
        break;
      case 'done':
        void this.finalize();
        break;
    }
  };

  private composed(): string {
    if (this.text && this.toolNote) return this.text;
    return this.toolNote || this.text;
  }

  private scheduleFlush(): void {
    const now = Date.now();
    const elapsed = now - this.lastFlush;
    if (elapsed >= FLUSH_INTERVAL_MS) {
      void this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => {
        this.timer = null;
        void this.flush();
      }, FLUSH_INTERVAL_MS - elapsed);
    }
  }

  private async flush(opts?: { final?: boolean }): Promise<void> {
    // Coalesce concurrent renders: if one is in flight, mark dirty and return.
    if (this.rendering) {
      this.dirty = true;
      return;
    }
    const content = this.composed();
    if (!content && !opts?.final) return;
    this.rendering = true;
    this.lastFlush = Date.now();
    try {
      await this.reply.render(content || '（无内容）', opts);
    } catch (e) {
      console.warn(`[gateway-sink] render failed: ${(e as Error).message}`);
    } finally {
      this.rendering = false;
      if (this.dirty) {
        this.dirty = false;
        await this.flush(opts);
      }
    }
  }

  private async finalize(): Promise<void> {
    if (this.finished) return;
    this.finished = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.errorMessage && !this.text) {
      try {
        await this.reply.render(`⚠️ ${this.errorMessage}`, { final: true });
      } catch (e) {
        console.warn(`[gateway-sink] error render failed: ${(e as Error).message}`);
      }
      return;
    }
    await this.flush({ final: true });
  }
}

export class EditorHistory {
    constructor(limit = 30) { this.limit = limit; this.states = []; this.index = -1; }
    push(state) {
        this.states = this.states.slice(0, this.index + 1);
        this.states.push(structuredClone(state));
        if (this.states.length > this.limit) this.states.shift();
        this.index = this.states.length - 1;
    }
    undo() { if (!this.canUndo()) return null; return structuredClone(this.states[--this.index]); }
    redo() { if (!this.canRedo()) return null; return structuredClone(this.states[++this.index]); }
    canUndo() { return this.index > 0; }
    canRedo() { return this.index >= 0 && this.index < this.states.length - 1; }
    clear() { this.states = []; this.index = -1; }
}

interface MemberRange {
  keyStart: number;
  valueStart: number;
  valueEnd: number;
}

interface ElementRange {
  start: number;
  end: number;
}

export class ConfigTextSplicer {
  private text: string;

  constructor(source: string) {
    this.text = source;
  }

  get content(): string {
    return this.text;
  }

  static isParseable(source: string, lenient: boolean): boolean {
    const tolerated = lenient ? ConfigTextSplicer.stripJsoncSyntax(source) : source;
    try {
      JSON.parse(tolerated);
      return true;
    } catch {
      return false;
    }
  }

  static stripJsoncSyntax(source: string): string {
    let stripped = "";
    let inString = false;
    let escaped = false;
    let index = 0;
    while (index < source.length) {
      const char = source[index];
      if (inString) {
        stripped += char;
        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === '"') {
          inString = false;
        }
        index++;
        continue;
      }
      if (char === '"') {
        inString = true;
        stripped += char;
        index++;
        continue;
      }
      if (char === "/" && (source[index + 1] === "/" || source[index + 1] === "*")) {
        index = ConfigTextSplicer.skipCommentsAndTrivia(source, index);
        continue;
      }
      if (char === ",") {
        const next = ConfigTextSplicer.skipCommentsAndTrivia(source, index + 1);
        if (source[next] === "}" || source[next] === "]") {
          index++;
          continue;
        }
      }
      stripped += char;
      index++;
    }
    return stripped;
  }

  hasArrayEntryMatching(key: string, match: (entry: string) => boolean): boolean {
    const root = this.rootObjectStart();
    if (root === null) return false;
    const member = this.findMember(root, key);
    if (member === null || this.text[member.valueStart] !== "[") return false;
    return this.arrayElements(member.valueStart).some((element) => {
      try {
        return match(JSON.parse(this.text.slice(element.start, element.end)) as string);
      } catch {
        return false;
      }
    });
  }

  addToArrayEntry(key: string, entry: string): boolean {
    const root = this.rootObjectStart();
    if (root === null) return false;
    const member = this.findMember(root, key);
    if (member === null) {
      return this.insertMember(root, key, JSON.stringify([entry]));
    }
    if (this.text[member.valueStart] !== "[") return false;
    return this.insertIntoContainer(member.valueStart, "]", JSON.stringify(entry));
  }

  removeArrayEntries(key: string, match: (entry: string) => boolean): boolean {
    const root = this.rootObjectStart();
    if (root === null) return false;
    const member = this.findMember(root, key);
    if (member === null || this.text[member.valueStart] !== "[") return false;
    const matched = this.arrayElements(member.valueStart).filter((element) => {
      try {
        return match(JSON.parse(this.text.slice(element.start, element.end)) as string);
      } catch {
        return false;
      }
    });
    if (matched.length === 0) return false;
    for (const element of matched.reverse()) {
      this.removeRange(element.start, element.end);
    }
    const emptied = this.findMember(root, key);
    if (emptied !== null && this.arrayElements(emptied.valueStart).length === 0) {
      this.removeRange(emptied.keyStart, emptied.valueEnd);
    }
    return true;
  }

  ensureStringMember(path: string[], key: string, value: string): boolean {
    const target = this.ensureObjectAtPath(path);
    if (target === null) return false;
    const member = this.findMember(target, key);
    if (member === null) {
      return this.insertMember(target, key, JSON.stringify(value));
    }
    if (this.text[member.valueStart] !== '"') return false;
    let current: string;
    try {
      current = JSON.parse(this.text.slice(member.valueStart, member.valueEnd)) as string;
    } catch {
      return false;
    }
    if (current === value) return false;
    this.text =
      this.text.slice(0, member.valueStart) + JSON.stringify(value) + this.text.slice(member.valueEnd);
    return true;
  }

  private ensureObjectAtPath(path: string[]): number | null {
    const root = this.rootObjectStart();
    if (root === null) return null;
    let objectStart = root;
    for (const key of path) {
      const member = this.findMember(objectStart, key);
      if (member === null) {
        if (!this.insertMember(objectStart, key, "{}")) return null;
        const created = this.findMember(objectStart, key);
        if (created === null) return null;
        objectStart = created.valueStart;
        continue;
      }
      if (this.text[member.valueStart] !== "{") return null;
      objectStart = member.valueStart;
    }
    return objectStart;
  }

  private insertMember(objectStart: number, key: string, valueText: string): boolean {
    const keyText = JSON.stringify(key);
    return this.insertIntoContainer(objectStart, "}", `${keyText}: ${valueText}`);
  }

  private insertIntoContainer(containerStart: number, closingChar: string, contentText: string): boolean {
    const first = this.skipTriviaFrom(containerStart + 1);
    if (first < 0) return false;
    const between = this.text.slice(containerStart + 1, first);
    if (this.text[first] === closingChar) {
      if (between.includes("\n")) {
        const lineStart = this.text.lastIndexOf("\n", first - 1) + 1;
        const outerIndent = this.text.slice(lineStart, first);
        this.text = this.insertAt(first, `${outerIndent}${this.detectIndentUnit()}${contentText}\n`);
        return true;
      }
      this.text = this.insertAt(first, contentText);
      return true;
    }
    if (between.includes("\n")) {
      const lineStart = this.text.lastIndexOf("\n", first - 1) + 1;
      const innerIndent = this.text.slice(lineStart, first);
      this.text = this.insertAt(containerStart + 1, `\n${innerIndent}${contentText},`);
      return true;
    }
    this.text = this.insertAt(containerStart + 1, `${contentText}, `);
    return true;
  }

  private removeRange(start: number, end: number): void {
    let trimmedStart = start;
    while (trimmedStart > 0 && /[ \t]/.test(this.text[trimmedStart - 1])) trimmedStart--;
    if (trimmedStart > 0 && this.text[trimmedStart - 1] === "\n") trimmedStart--;
    let trimmedEnd = end;
    const after = this.skipTriviaFrom(end);
    if (after >= 0 && this.text[after] === ",") {
      trimmedEnd = after + 1;
    } else {
      trimmedStart = this.absorbPrecedingComma(trimmedStart);
    }
    this.text = this.text.slice(0, trimmedStart) + this.text.slice(trimmedEnd);
  }

  private absorbPrecedingComma(start: number): number {
    let candidate = start;
    while (candidate > 0 && /[ \t\r\n]/.test(this.text[candidate - 1])) candidate--;
    if (candidate > 0 && this.text[candidate - 1] === ",") {
      return candidate - 1;
    }
    return start;
  }

  private rootObjectStart(): number | null {
    const start = this.skipTriviaFrom(0);
    if (start < 0 || this.text[start] !== "{") return null;
    return start;
  }

  private findMember(objectStart: number, key: string): MemberRange | null {
    let cursor = this.skipTriviaFrom(objectStart + 1);
    if (cursor < 0 || this.text[cursor] === "}") return null;
    for (;;) {
      if (this.text[cursor] !== '"') return null;
      const keyEnd = this.scanString(cursor);
      if (keyEnd < 0) return null;
      let name: string;
      try {
        name = JSON.parse(this.text.slice(cursor, keyEnd)) as string;
      } catch {
        return null;
      }
      const colon = this.skipTriviaFrom(keyEnd);
      if (colon < 0 || this.text[colon] !== ":") return null;
      const valueStart = this.skipTriviaFrom(colon + 1);
      if (valueStart < 0) return null;
      const valueEnd = this.scanValueEnd(valueStart);
      if (valueEnd < 0) return null;
      if (name === key) {
        return { keyStart: cursor, valueStart, valueEnd };
      }
      const next = this.skipTriviaFrom(valueEnd);
      if (next >= 0 && this.text[next] === ",") {
        cursor = this.skipTriviaFrom(next + 1);
        if (cursor < 0) return null;
        continue;
      }
      return null;
    }
  }

  private arrayElements(arrayStart: number): ElementRange[] {
    const elements: ElementRange[] = [];
    let cursor = this.skipTriviaFrom(arrayStart + 1);
    if (cursor < 0 || this.text[cursor] === "]") return elements;
    for (;;) {
      const start = cursor;
      const end = this.scanValueEnd(start);
      if (end < 0) return elements;
      elements.push({ start, end });
      const next = this.skipTriviaFrom(end);
      if (next >= 0 && this.text[next] === ",") {
        cursor = this.skipTriviaFrom(next + 1);
        if (cursor < 0) return elements;
        continue;
      }
      return elements;
    }
  }

  private skipTriviaFrom(index: number): number {
    const next = ConfigTextSplicer.skipCommentsAndTrivia(this.text, index);
    return next >= this.text.length ? -1 : next;
  }

  private static skipCommentsAndTrivia(source: string, start: number): number {
    let cursor = start;
    while (cursor < source.length) {
      const char = source[cursor];
      if (char === " " || char === "\t" || char === "\n" || char === "\r") {
        cursor++;
        continue;
      }
      if (char === "/" && source[cursor + 1] === "/") {
        while (cursor < source.length && source[cursor] !== "\n") {
          cursor++;
        }
        continue;
      }
      if (char === "/" && source[cursor + 1] === "*") {
        cursor += 2;
        while (cursor < source.length && !(source[cursor] === "*" && source[cursor + 1] === "/")) {
          cursor++;
        }
        cursor += 2;
        continue;
      }
      return cursor;
    }
    return cursor;
  }

  private scanString(index: number): number {
    let cursor = index + 1;
    while (cursor < this.text.length) {
      const char = this.text[cursor];
      if (char === "\\") {
        cursor += 2;
        continue;
      }
      if (char === '"') {
        return cursor + 1;
      }
      cursor++;
    }
    return -1;
  }

  private scanValueEnd(index: number): number {
    const char = this.text[index];
    if (char === '"') return this.scanString(index);
    if (char === "{" || char === "[") {
      let depth = 0;
      let cursor = index;
      while (cursor < this.text.length) {
        const current = this.text[cursor];
        if (current === '"') {
          cursor = this.scanString(cursor);
          if (cursor < 0) return -1;
          continue;
        }
        if (current === "/" && (this.text[cursor + 1] === "/" || this.text[cursor + 1] === "*")) {
          cursor = ConfigTextSplicer.skipCommentsAndTrivia(this.text, cursor);
          continue;
        }
        if (current === "{" || current === "[") {
          depth++;
        } else if (current === "}" || current === "]") {
          depth--;
          if (depth === 0) return cursor + 1;
        }
        cursor++;
      }
      return -1;
    }
    let cursor = index;
    while (cursor < this.text.length && !",}]\n\r".includes(this.text[cursor])) {
      cursor++;
    }
    return cursor;
  }

  private detectIndentUnit(): string {
    const match = this.text.match(/\n([ \t]+)/);
    return match ? match[1] : "  ";
  }

  private insertAt(index: number, insertion: string): string {
    return this.text.slice(0, index) + insertion + this.text.slice(index);
  }
}

class IntersectionWatcherDOM {
  static split(entries) {
    const shown = [];
    const hidden = [];
    if (!Array.isArray(entries)) {
      return { shown, hidden };
    }
    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i];
      if (!entry || !(entry.target instanceof Element)) {
        continue;
      }
      if (entry.isIntersecting) {
        shown.push(entry);
      } else {
        hidden.push(entry);
      }
    }
    return { shown, hidden };
  }
}
export {
  IntersectionWatcherDOM
};

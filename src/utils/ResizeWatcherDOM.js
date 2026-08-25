class ResizeWatcherDOM {
  static collect(entries) {
    const sizes = [];
    if (!Array.isArray(entries)) {
      return sizes;
    }
    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i];
      if (!entry || !(entry.target instanceof Element)) {
        continue;
      }
      const box = entry.contentRect;
      sizes.push({
        target: entry.target,
        width: box ? box.width : 0,
        height: box ? box.height : 0
      });
    }
    return sizes;
  }
}
export {
  ResizeWatcherDOM
};

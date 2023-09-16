export class FancyMap<K, V> extends Map {
  async getOrDefault(key: K, valueGetter: (arg0: K) => Promise<V>): Promise<V> {
    if (this.has(key)) {
      return this.get(key);
    }
    const result = await valueGetter(key);
    this.set(key, result);
    return result;
  }
}

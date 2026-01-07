/**
 * EKMS API Client
 * 封裝與 EKMS 後端 API 的通訊
 */

export function createApiClient(config) {
  const baseUrl = config.apiUrl || process.env.EKMS_API_URL || 'http://localhost:3000';
  const apiKey = config.apiKey || process.env.EKMS_API_KEY;
  const timeout = config.timeout || 30000;

  async function request(method, path, options = {}) {
    const url = new URL(path, baseUrl);

    // 添加查詢參數
    if (options.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, value);
        }
      });
    }

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(apiKey && { 'Authorization': `Bearer ${apiKey}` }),
      ...options.headers
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url.toString(), {
        method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
        error.response = {
          status: response.status,
          statusText: response.statusText,
          data: await response.json().catch(() => ({}))
        };
        throw error;
      }

      const data = await response.json();
      return { data, status: response.status };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        const timeoutError = new Error(`Request timeout after ${timeout}ms`);
        timeoutError.code = 'TIMEOUT';
        throw timeoutError;
      }

      throw error;
    }
  }

  return {
    get: (path, options) => request('GET', path, options),
    post: (path, body, options) => request('POST', path, { ...options, body }),
    put: (path, body, options) => request('PUT', path, { ...options, body }),
    delete: (path, options) => request('DELETE', path, options),

    // 健康檢查
    async healthCheck() {
      try {
        await this.get('/health');
        return true;
      } catch {
        return false;
      }
    }
  };
}

export default createApiClient;

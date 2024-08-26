// pages/api/expand.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import fetch, { RequestInfo, RequestInit, Response } from 'node-fetch';

type TRecord = { recordId: string, url: string }

type ExpandRequest = {
  shortUrls: TRecord[];
};

type ExpandResponse = {
  [key: string]: string | null;
};

const MAX_CONCURRENT_REQUESTS = 10;

async function fetchWithTimeout(url: URL | RequestInfo, init?: RequestInit | undefined, timeout: number = 5000): Promise<Response> {
  const controller = new AbortController();
  const { signal } = controller;

  const timeoutPromise = new Promise<Response>((_, reject) => {
    const timer = setTimeout(() => {
      controller.abort(); // 终止 fetch 请求
      reject(new Error('Request timed out'));
    }, timeout);

    init?.signal?.addEventListener('abort', () => clearTimeout(timer));
  });

  const fetchPromise = fetch(url, { ...init, signal });
  return Promise.race([fetchPromise, timeoutPromise]);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).end(); // 只允许 POST 请求
  }

  const { shortUrls } = req.body as ExpandRequest;

  if (!Array.isArray(shortUrls)) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const results: ExpandResponse = {};
  const executingRequests: Promise<void>[] = [];

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch (_) {
      return false;
    }
  };

  // 用于处理单个短链
  const processUrl = async (record: TRecord) => {
    const shortUrl = record?.url
    const recordId = record?.recordId

    if (!record || !recordId || !shortUrl || !isValidUrl(shortUrl)) {
      results[record.recordId] = null; // 如果 URL 无效，直接返回 null
      return;
    }

    try {
      const response = await fetchWithTimeout(shortUrl, {
        method: 'HEAD',
        redirect: 'manual'
      });

      if (response.status >= 300 && response.status < 400) {
        const longUrl = response.headers.get('location');
        results[recordId] = longUrl || shortUrl;
      } else {
        results[recordId] = shortUrl; // 没有重定向，返回原始 URL
      }
    } catch (error) {
      results[recordId] = null; // 请求失败，返回 null
    }
  };

  // 用于控制并发量的请求池
  const addRequestToQueue = async (record: TRecord) => {
    // 创建并启动新的请求
    const promise = processUrl(record).finally(() => {
      // 请求完成后，从执行队列中移除该请求
      executingRequests.splice(executingRequests.indexOf(promise), 1);
    });

    // 将新的请求加入执行队列
    executingRequests.push(promise);

    // 如果执行队列中的请求数量达到了并发限制，等待任一请求完成
    if (executingRequests.length >= MAX_CONCURRENT_REQUESTS) {
      await Promise.race(executingRequests);
    }
  };

  // 遍历所有短链并加入请求队列
  for (const record of shortUrls) {
    await addRequestToQueue(record);
  }

  // 等待所有请求完成
  await Promise.all(executingRequests);

  res.status(200).json(results);
}
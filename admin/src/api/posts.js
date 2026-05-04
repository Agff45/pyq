import client from './client';

export function getPosts(params) {
  return client.get('/posts', { params });
}

export function getPost(filename) {
  return client.get(`/posts/${encodeURIComponent(filename)}`);
}

export function createPost(data) {
  return client.post('/posts', data);
}

export function updatePost(filename, data) {
  return client.put(`/posts/${encodeURIComponent(filename)}`, data);
}

export function deletePost(filename) {
  return client.delete(`/posts/${encodeURIComponent(filename)}`);
}

export function togglePin(filename) {
  return client.put(`/posts/${encodeURIComponent(filename)}/pin`);
}

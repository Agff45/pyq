import client from './client';

export function login(username, password) {
  return client.post('/auth/login', { username, password });
}

export function verifyToken() {
  return client.get('/auth/verify');
}

import { test, expect } from '@playwright/test';

test.describe('RLS / Segurança', () => {
  test('Unauthenticated API call is rejected', async ({ request }) => {
    const response = await request.post(
      `${process.env.VITE_SUPABASE_URL}/functions/v1/mentor-chat`,
      { data: { message: 'test' } }
    );
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('Edge function with invalid token returns 401', async ({ request }) => {
    const response = await request.post(
      `${process.env.VITE_SUPABASE_URL}/functions/v1/mentor-chat`,
      {
        data: { message: 'test' },
        headers: { Authorization: 'Bearer invalid-token-12345' },
      }
    );
    expect([401, 403]).toContain(response.status());
  });

  test('Aluno cannot access other user data via Supabase REST', async ({ request }) => {
    // Login as aluno
    const loginRes = await request.post(
      `${process.env.VITE_SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        data: {
          email: process.env.E2E_ALUNO_EMAIL!,
          password: process.env.E2E_ALUNO_PASSWORD!,
        },
        headers: {
          apikey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY!,
          'Content-Type': 'application/json',
        },
      }
    );
    const { access_token } = await loginRes.json();
    expect(access_token).toBeTruthy();

    // Try to read all profiles (RLS should filter)
    const profilesRes = await request.get(
      `${process.env.VITE_SUPABASE_URL}/rest/v1/profiles?select=*`,
      {
        headers: {
          apikey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY!,
          Authorization: `Bearer ${access_token}`,
        },
      }
    );
    const profiles = await profilesRes.json();
    // Should only see own profile or empty (RLS)
    expect(profiles.length).toBeLessThanOrEqual(1);
  });

  test('Aluno cannot insert into admin tables', async ({ request }) => {
    const loginRes = await request.post(
      `${process.env.VITE_SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        data: {
          email: process.env.E2E_ALUNO_EMAIL!,
          password: process.env.E2E_ALUNO_PASSWORD!,
        },
        headers: {
          apikey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY!,
          'Content-Type': 'application/json',
        },
      }
    );
    const { access_token } = await loginRes.json();

    // Try to insert into pipeline_alerts (admin-only table)
    const insertRes = await request.post(
      `${process.env.VITE_SUPABASE_URL}/rest/v1/pipeline_alerts`,
      {
        data: { alert_type: 'hack', message: 'test injection' },
        headers: {
          apikey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY!,
          Authorization: `Bearer ${access_token}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
      }
    );
    // Should be rejected by RLS
    expect([401, 403, 404, 409]).toContain(insertRes.status());
  });

  test('Expired/old token is rejected', async ({ request }) => {
    const oldToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzenN5c2t1bWNtdWtudW13eHRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MTYwMDAwMDAwMX0.invalid';
    
    const response = await request.get(
      `${process.env.VITE_SUPABASE_URL}/rest/v1/profiles?select=*`,
      {
        headers: {
          apikey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY!,
          Authorization: `Bearer ${oldToken}`,
        },
      }
    );
    // Should return empty or error (not other users' data)
    const data = await response.json();
    expect(Array.isArray(data) ? data.length : 0).toBe(0);
  });
});

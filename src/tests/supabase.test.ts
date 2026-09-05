import { describe, expect, it } from 'vitest';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

describe('optional Supabase configuration', () => {
  it('缺少环境变量时保持本地模式而不是抛错', () => {
    expect(isSupabaseConfigured).toBe(false);
    expect(supabase).toBeNull();
  });
});

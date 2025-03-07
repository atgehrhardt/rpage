import { describe, it, expect } from 'vitest';
import { getAutomations, createAutomation } from '../src/utils/api';

describe('API Tests', () => {
  it('should get automations', async () => {
    const result = await getAutomations();
    expect(result.success).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('should create a new automation', async () => {
    const newAutomation = {
      name: 'Test Automation',
      description: 'Created in test',
      script: 'async function run() { return true; }',
      status: 'idle' as const
    };
    
    const result = await createAutomation(newAutomation);
    expect(result.success).toBe(true);
    expect(result.data?.name).toBe('Test Automation');
    expect(result.data?.id).toBeDefined();
  });
});
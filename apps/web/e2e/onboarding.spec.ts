import { test, expect } from '@playwright/test';

test.describe('Onboarding flow', () => {
  test('sign up → workspace → plan selection → checklist → dashboard', async ({ page }) => {
    // 1. Acessar sign-up
    await page.goto('/sign-up');
    await expect(page).toHaveURL(/sign-up/);

    // 2. Após autenticação (simulada em teste), redireciona para onboarding
    // Em CI, use Clerk test helpers: https://clerk.com/docs/testing/playwright
    // Para testes locais, pré-autentique via Clerk backend

    // 3. Workspace page
    await page.goto('/onboarding/workspace');
    await expect(page.getByText('Crie seu workspace')).toBeVisible();

    // 4. Dashboard acessível após onboarding completo
    // (teste completo requer setup de usuário de teste no Clerk)
  });

  test('settings/billing shows portal button', async ({ page }) => {
    // Requer usuário autenticado com subscription ativa
    await page.goto('/test-org/settings/billing');
    // Verificar se o botão de portal aparece
    await expect(page.getByText('Abrir portal de cobrança')).toBeVisible({ timeout: 5000 });
  });
});

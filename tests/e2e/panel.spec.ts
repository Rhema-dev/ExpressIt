import { test, expect } from '@playwright/test';
test('browser preview searches, compiles parameters and has no runtime errors', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'ExpressIt' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apply', exact: true })).toBeDisabled();
  await page.locator('.code-section summary').click();
  await page.getByLabel('Frequency / sec').fill('3');
  await page.getByLabel('Amount', { exact: true }).fill('25');
  await expect(page.locator('.detail .code-preview')).toHaveText('wiggle(3, 25);');
  await page.getByLabel('Search expressions', { exact: true }).fill('timer');
  await expect(page.locator('.detail h2')).toHaveText('Time Counter');
  expect(errors).toEqual([]);
});
test('custom expression create, edit, favorite, restart and delete', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '+ New' }).click();
  await page.getByLabel('Name', { exact: true }).fill('My camera shake');
  await page.getByRole('textbox', { name: 'Expression code', exact: true }).fill('wiggle(3, 25);');
  await page.getByRole('button', { name: 'Save expression', exact: true }).click();
  await expect(page.locator('.detail h2')).toHaveText('My camera shake');
  await page.getByRole('button', { name: 'Favorite My camera shake', exact: true }).click();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Gentle shake');
  await page.getByRole('button', { name: 'Save expression', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Favorites', exact: true }).click();
  await expect(page.locator('.detail h2')).toHaveText('Gentle shake');
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Delete expression', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No expressions found' })).toBeVisible();
});
test('pack review runs no code; import conflicts and export roundtrip', async ({ page }) => {
  await page.goto('/');
  const pack = {
    format: 'expressit-pack',
    schemaVersion: 1,
    name: 'My test pack',
    exportedAt: new Date().toISOString(),
    expressions: [
      {
        id: 'user.test',
        version: 1,
        source: 'user',
        name: 'Pack item',
        description: 'Reviewed locally',
        category: 'Utility',
        tags: [],
        parameters: [],
        compatibility: {},
        template: 'value + 5;',
      },
    ],
  };
  const upload = () =>
    page.getByLabel('Import pack file').setInputFiles({
      name: 'test.evpack',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(pack)),
    });
  await upload();
  await expect(page.getByRole('dialog')).toContainText('executable After Effects expression code');
  await expect(page.locator('.expression-row')).toHaveCount(23);
  await page.getByRole('button', { name: 'Import pack', exact: true }).click();
  await expect(page.locator('.detail h2')).toHaveText('Pack item');
  await upload();
  await page.getByRole('button', { name: 'Import pack', exact: true }).click();
  await expect(page.locator('.expression-row')).toHaveCount(2);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export 2 expressions' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.evpack$/);
  const stream = await download.createReadStream();
  let json = '';
  for await (const chunk of stream!) json += chunk.toString();
  expect(JSON.parse(json).expressions).toHaveLength(2);
});
test('corrupt library is preserved and blocks writes while core stays usable', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem('expressit.preview.library.json', 'corrupt data'),
  );
  await page.goto('/');
  await expect(page.getByRole('button', { name: '+ New' })).toBeDisabled();
  await expect(page.getByText('Local storage needs attention.')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('expressit.preview.library.json'))).toBe(
    'corrupt data',
  );
  await expect(page.locator('.expression-row')).toHaveCount(23);
});
test('layout fits a 300px dock and dialog keyboard close restores focus', async ({ page }) => {
  await page.setViewportSize({ width: 300, height: 650 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(300);
  await page.getByRole('button', { name: '+ New' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '+ New' })).toBeFocused();
  await page.screenshot({ path: 'test-results/panel-300.png', fullPage: true });
});
test('invalid parameter and invalid import errors are actionable', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Amount', { exact: true }).fill('-5');
  await expect(page.getByRole('alert')).toContainText('at least 0');
  await page.getByLabel('Import pack file').setInputFiles({
    name: 'bad.evpack',
    mimeType: 'application/json',
    buffer: Buffer.from('{"format":"jsx","actions":[]}'),
  });
  await expect(page.getByText(/unsupported field/)).toBeVisible();
});

test('minimal dock keeps Apply and social links in reach', async ({ page }) => {
  await page.setViewportSize({ width: 300, height: 650 });
  await page.goto('/');
  const apply = page.getByRole('button', { name: 'Apply', exact: true });
  const footer = page.locator('.bottom-bar');
  expect((await apply.boundingBox())!.y + (await apply.boundingBox())!.height).toBeLessThanOrEqual(
    (await footer.boundingBox())!.y,
  );
  for (const [name, url] of [
    ['TikTok', 'https://www.tiktok.com/@madebykhua'],
    ['Instagram', 'https://www.instagram.com/madebykhua/'],
    ['YouTube', 'https://www.youtube.com/@madebykhua'],
  ]) {
    const link = page.getByRole('link', { name: name + ' @madebykhua', exact: true });
    await expect(link).toHaveAttribute('href', url);
    await expect(link).toBeInViewport();
  }
  await expect(page.getByRole('button', { name: 'Save from AE', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '+ New', exact: true }).click();
  await expect(page.getByLabel('Name', { exact: true })).toBeFocused();
  await expect(page.getByLabel('Parameters (JSON)', { exact: true })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Save expression', exact: true })).toBeInViewport();
  await page.screenshot({ path: 'test-results/expressit-editor-300.png' });
});

test('CEP controls capture, save, apply and open social profiles through the native bridge', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const files = new Map<string, string>();
    const property = {
      name: 'Position',
      matchName: 'ADBE Position',
      valueType: 'TwoD_SPATIAL',
      canSetExpression: true,
      hasExpression: true,
      expressionEnabled: true,
      expressionText: 'value + [2, 3];',
      layerName: 'Shape 1',
      compName: 'Test comp',
      numKeys: 0,
      token: 'position-token',
    };
    Object.assign(window, {
      __adobe_cep__: {
        getHostEnvironment: () => '{}',
        getSystemPath: () => '/test-data',
        evalScript: (command: string, callback: (result: string) => void) => {
          const match = /^ExpressIt\.(\w+)\((.*)\)$/.exec(command)!;
          if (match[1] === 'injectExpression') {
            const args = JSON.parse('[' + match[2] + ']');
            property.expressionText = decodeURIComponent(args[0]);
            window.sessionStorage.setItem('applied', property.expressionText);
            setTimeout(() => callback(JSON.stringify({ ok: true, propertyName: 'Position' })), 0);
          } else {
            setTimeout(() => callback(JSON.stringify({ ok: true, property })), 0);
          }
        },
      },
      cep: {
        fs: {
          stat: () => ({ err: 0, data: { isDirectory: () => true } }),
          readFile: (path: string) => ({
            err: files.has(path) ? 0 : 3,
            data: files.get(path) ?? '',
          }),
          writeFile: (path: string, data: string) => {
            files.set(path, data);
            return { err: 0 };
          },
        },
        util: {
          openURLInDefaultBrowser: (url: string) => {
            window.sessionStorage.setItem('openedURL', url);
            return 0;
          },
        },
      },
    });
  });
  await page.setViewportSize({ width: 300, height: 650 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Save from AE', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Save from AE', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Expression code', exact: true })).toHaveValue(
    'value + [2, 3];',
  );
  await page.getByLabel('Name', { exact: true }).fill('Captured position');
  await page.getByRole('button', { name: 'Save expression', exact: true }).click();
  await expect(page.locator('.detail h2')).toHaveText('Captured position');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Replace existing expression?');
  await page.getByRole('button', { name: 'Replace expression', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('applied')))
    .toBe('value + [2, 3];');
  await page.getByRole('link', { name: 'YouTube @madebykhua', exact: true }).click();
  expect(await page.evaluate(() => sessionStorage.getItem('openedURL'))).toBe(
    'https://www.youtube.com/@madebykhua',
  );
});

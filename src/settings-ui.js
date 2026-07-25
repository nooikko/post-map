import { get, set } from './settings.js';
import { precacheAllTiles } from './sw-register.js';

/**
 * Build a settings cog in the topbar that opens a native <dialog> modal.
 * Currently exposes one preference (km vs mi); designed to grow.
 */
export function buildSettingsButton(topbarContainer) {
    const btn = document.createElement('button');
    btn.className = 'icon-btn';
    btn.id = 'settings-toggle';
    btn.setAttribute('aria-label', 'Settings');
    btn.title = 'Settings';
    btn.innerHTML = cogSvg();
    btn.addEventListener('click', openDialog);
    topbarContainer.appendChild(btn);
}

let dialogEl = null;

function openDialog() {
    if (!dialogEl) {
        dialogEl = buildDialog();
        document.body.appendChild(dialogEl);
    }
    syncDialogToState(dialogEl);
    dialogEl.showModal();
}

function buildDialog() {
    const dialog = document.createElement('dialog');
    dialog.className = 'settings-dialog';
    dialog.innerHTML = `
        <form method="dialog" class="settings-form">
            <header class="settings-header">
                <h2>Settings</h2>
                <button type="button" class="icon-btn settings-close" aria-label="Close">${closeSvg()}</button>
            </header>
            <section class="settings-section">
                <label class="settings-label">Offline use</label>
                <p class="settings-hint">Download every map tile (~12 MB) so the map works without an internet connection.</p>
                <button type="button" class="tool-btn" id="precache-btn">Download for offline</button>
                <div class="precache-status" id="precache-status" hidden></div>
            </section>
            <footer class="settings-footer">
                <button type="button" class="tool-btn--ghost" value="cancel">Cancel</button>
                <button type="submit" class="tool-btn tool-btn--primary" value="save">Save</button>
            </footer>
        </form>
    `;

    const form = dialog.querySelector('.settings-form');
    const closeBtn = dialog.querySelector('.settings-close');
    const cancelBtn = dialog.querySelector('[value="cancel"]');
    const precacheBtn = dialog.querySelector('#precache-btn');
    const precacheStatus = dialog.querySelector('#precache-status');

    closeBtn.addEventListener('click', () => dialog.close('cancel'));
    cancelBtn.addEventListener('click', () => dialog.close('cancel'));
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        dialog.close('save');
    });
    dialog.addEventListener('click', (e) => {
        // Click on the backdrop closes the dialog
        if (e.target === dialog) dialog.close('cancel');
    });

    precacheBtn.addEventListener('click', async () => {
        precacheBtn.disabled = true;
        precacheStatus.hidden = false;
        precacheStatus.textContent = 'Starting download…';
        try {
            const final = await precacheAllTiles(({ done, total }) => {
                const pct = Math.round((done / total) * 100);
                precacheStatus.textContent = `Downloading… ${done} / ${total} tiles (${pct}%)`;
            });
            precacheStatus.textContent = `Done! ${final.done} tiles cached.${final.failed ? ' ' + final.failed + ' failed.' : ''}`;
            precacheBtn.textContent = 'Re-download';
        } catch (err) {
            precacheStatus.textContent = `Failed: ${err.message}`;
        } finally {
            precacheBtn.disabled = false;
        }
    });

    return dialog;
}

function syncDialogToState(_dialog) {}

function cogSvg() {
    return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z" stroke="currentColor" stroke-width="1.4"/>
        <path d="M13.5 8c0-.4 0-.7-.1-1l1.3-1-1.5-2.6-1.6.6c-.5-.4-1-.7-1.6-.9L9.5 1.5h-3l-.5 1.6c-.6.2-1.1.5-1.6.9l-1.6-.6L1.3 6l1.3 1c-.1.3-.1.6-.1 1s0 .7.1 1l-1.3 1L2.8 11.6l1.6-.6c.5.4 1 .7 1.6.9L6.5 13.5h3l.5-1.6c.6-.2 1.1-.5 1.6-.9l1.6.6 1.5-2.6-1.3-1c.1-.3.1-.6.1-1Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
    </svg>`;
}

function closeSvg() {
    return `<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    </svg>`;
}

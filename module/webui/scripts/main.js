import { appListContainer, updateCard, fetchAppList } from './applist.js';
import { initializeAvailableLanguages, detectUserLanguage, loadTranslations, setupLanguageMenu, translations } from './language.js';
import { aospkb } from './menu_option.js';
import { searchMenuContainer, searchInput, clearBtn, setupMenuToggle } from './search_menu.js';
import { updateCheck } from './update.js';

// Header Elements
const headerBlock = document.querySelector('.header-block');
const title = document.querySelector('.header');
export const noConnection = document.querySelector('.no-connection');

// Loading, Save and Prompt Elements
const loadingIndicator = document.querySelector('.loading');
const prompt = document.getElementById('prompt');
export const floatingBtn = document.querySelector('.floating-btn');

export const basePath = "set-path";
export const appsWithExclamation = [];
export const appsWithQuestion = [];
const ADDITIONAL_APPS = [ "com.google.android.gms", "io.github.vvb2060.keyattestation", "io.github.vvb2060.mahoshojo", "icu.nullptr.nativetest" ];
const rippleClasses = ['.language-option', '.menu-button', '.menu-options li', '.search-card', '.card', '.update-card', '.link-icon', '.floating-btn', '.uninstall-container'];

// Variables
let e = 0;
let isRefreshing = false;

// Function to load the version from module.prop
async function getModuleVersion() {
    const moduleVersion = document.getElementById('module-version');
    try {
        const version = await execCommand(`grep '^version=' ${basePath}common/update/module.prop | cut -d'=' -f2`);
        moduleVersion.textContent = version;
    } catch (error) {
        console.error("Failed to read version from module.prop:", error);
        updateVersion("Error reading version from module.prop");
    }
}

// Function to refresh app list
async function refreshAppList() {
    isRefreshing = true;
    title.style.transform = 'translateY(0)';
    searchMenuContainer.style.transform = 'translateY(0)';
    floatingBtn.style.transform = 'translateY(0)';
    searchInput.value = '';
    clearBtn.style.display = "none";
    appListContainer.innerHTML = '';
    loadingIndicator.style.display = 'flex';
    document.querySelector('.uninstall-container').classList.add('hidden-uninstall');
    await new Promise(resolve => setTimeout(resolve, 500));
    window.scrollTo(0, 0);
    if (noConnection.style.display === "flex") {
        try {
            updateCheck();
            await execCommand(`[ -f ${basePath}common/tmp/exclude-list ] && rm -f "${basePath}common/tmp/exclude-list"`);
        } catch (error) {
            console.error("Error occurred:", error);
        }
    }
    await fetchAppList();
    applyRippleEffect();
    loadingIndicator.style.display = 'none';
    document.querySelector('.uninstall-container').classList.remove('hidden-uninstall');
    isRefreshing = false;
}

// Function to check if Magisk
async function checkMagisk() {
    const selectDenylistElement = document.getElementById('select-denylist');
    try {
        const magiskEnv = await execCommand(`command -v magisk >/dev/null 2>&1 && echo "OK"`);
        if (magiskEnv.trim() === "OK") {
            console.log("Denylist conditions met, displaying element.");
            selectDenylistElement.style.display = "flex";
        } else {
            console.log("not running on Magisk, leaving denylist element hidden.");
        }
    } catch (error) {
        console.error("Error while checking denylist conditions:", error);
    }
}

// Function to show the prompt with a success or error message
export function showPrompt(key, isSuccess = true) {
    const message = key.split('.').reduce((acc, k) => acc && acc[k], translations) || key;
    prompt.textContent = message;
    prompt.classList.toggle('error', !isSuccess);
    if (window.promptTimeout) {
        clearTimeout(window.promptTimeout);
    }
    setTimeout(() => {
        prompt.classList.add('visible');
        prompt.classList.remove('hidden');
        window.promptTimeout = setTimeout(() => {
            prompt.classList.remove('visible');
            prompt.classList.add('hidden');
        }, 3000);
    }, 200);
}

// Save configure and preserve ! and ? in target.txt
document.getElementById("save").addEventListener("click", async () => {
    const selectedApps = Array.from(appListContainer.querySelectorAll(".checkbox:checked"))
        .map(checkbox => checkbox.closest(".card").querySelector(".content").getAttribute("data-package"));
    let finalAppsList = new Set(selectedApps);
    ADDITIONAL_APPS.forEach(app => {
        finalAppsList.add(app);
    });
    finalAppsList = Array.from(finalAppsList);
    try {
        const modifiedAppsList = finalAppsList.map(app => {
            if (appsWithExclamation.includes(app)) {
                return `${app}!`;
            } else if (appsWithQuestion.includes(app)) {
                return `${app}?`;
            }
            return app;
        });
        const updatedTargetContent = modifiedAppsList.join("\n");
        await execCommand(`echo "${updatedTargetContent}" > /data/adb/tricky_store/target.txt`);
        console.log("target.txt updated successfully.");
        showPrompt("prompt.saved_target");
        for (const app of appsWithExclamation) {
            await execCommand(`sed -i 's/^${app}$/${app}!/' /data/adb/tricky_store/target.txt`);
        }
        for (const app of appsWithQuestion) {
            await execCommand(`sed -i 's/^${app}$/${app}?/' /data/adb/tricky_store/target.txt`);
        }
        console.log("App names modified in target.txt.");
    } catch (error) {
        console.error("Failed to update target.txt:", error);
        showPrompt("prompt.save_error", false);
    }
    await refreshAppList();
});

// Uninstall WebUI
document.querySelector(".uninstall-container").addEventListener("click", async () => {
    try {
        await execCommand(`sh ${basePath}common/get_extra.sh --uninstall`);
        console.log("uninstall script executed successfully.");
        showPrompt("prompt.uninstall_prompt");
    } catch (error) {
        console.error("Failed to execute uninstall command:", error);
        showPrompt("prompt.uninstall_failed", false);
    }
});

// Function to check if running in MMRL
function adjustHeaderForMMRL() {
    if (typeof ksu !== 'undefined' && ksu.mmrl) {
        console.log("Running in MMRL");
        title.style.top = 'var(--window-inset-top)';
        const insetTop = getComputedStyle(document.documentElement).getPropertyValue('--window-inset-top');
        const insetTopValue = parseInt(insetTop, 10);
        searchMenuContainer.style.top = `${insetTopValue + 40}px`;
        headerBlock.style.display = 'block';
    }
}

// Function to apply ripple effect
function applyRippleEffect() {
    rippleClasses.forEach(selector => {
        document.querySelectorAll(selector).forEach(element => {
            element.addEventListener("click", function(event) {
                const ripple = document.createElement("span");
                ripple.classList.add("ripple");

                const rect = element.getBoundingClientRect();
                const width = rect.width;
                const size = Math.max(rect.width, rect.height);
                const x = event.clientX - rect.left - size / 2;
                const y = event.clientY - rect.top - size / 2;

                let duration = 0.3 + (width / 800) * 0.5;
                duration = Math.min(0.8, Math.max(0.2, duration));
                ripple.style.width = ripple.style.height = `${size}px`;
                ripple.style.left = `${x}px`;
                ripple.style.top = `${y}px`;
                ripple.style.animationDuration = `${duration}s`;
                element.appendChild(ripple);
                ripple.addEventListener("animationend", () => {
                    ripple.remove();
                });
            });
        });
    });
}

// Scroll event
let lastScrollY = window.scrollY;
const scrollThreshold = 40;
window.addEventListener('scroll', () => {
    if (isRefreshing) return;
    if (window.scrollY > lastScrollY && window.scrollY > scrollThreshold) {
        title.style.transform = 'translateY(-80px)';
        headerBlock.style.transform = 'translateY(-80px)';
        searchMenuContainer.style.transform = 'translateY(-40px)';
        floatingBtn.style.transform = 'translateY(0)';
    } else if (window.scrollY < lastScrollY) {
        headerBlock.style.transform = 'translateY(0)';
        title.style.transform = 'translateY(0)';
        searchMenuContainer.style.transform = 'translateY(0)';
        floatingBtn.style.transform = 'translateY(-120px)';
    }
    lastScrollY = window.scrollY;
});

// Initial load
document.addEventListener('DOMContentLoaded', async () => {
    adjustHeaderForMMRL();
    getModuleVersion();
    await initializeAvailableLanguages();
    const userLang = detectUserLanguage();
    await loadTranslations(userLang);
    setupMenuToggle();
    setupLanguageMenu();
    await fetchAppList();
    applyRippleEffect();
    checkMagisk();
    updateCheck();
    loadingIndicator.style.display = "none";
    document.getElementById("refresh").addEventListener("click", refreshAppList);
    document.getElementById("aospkb").addEventListener("click", aospkb);
    document.querySelector('.uninstall-container').classList.remove('hidden-uninstall');
});

// Redirect to GitHub release page
updateCard.addEventListener('click', async () => {
    try {
        await execCommand('am start -a android.intent.action.VIEW -d https://github.com/KOWX712/Tricky-Addon-Update-Target-List/releases/latest');
    } catch (error) {
        console.error('Error opening GitHub Release link:', error);
    }
});

// Function to execute shell commands
export async function execCommand(command) {
    return new Promise((resolve, reject) => {
        const callbackName = `exec_callback_${Date.now()}_${e++}`;
        window[callbackName] = (errno, stdout, stderr) => {
            delete window[callbackName];
            if (errno === 0) {
                resolve(stdout);
            } else {
                console.error(`Error executing command: ${stderr}`);
                reject(stderr);
            }
        };
        try {
            ksu.exec(command, "{}", callbackName);
        } catch (error) {
            console.error(`Execution error: ${error}`);
            reject(error);
        }
    });
}
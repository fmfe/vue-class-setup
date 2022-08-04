import {
    reactive,
    computed,
    onActivated,
    onBeforeMount,
    onBeforeUnmount,
    onBeforeUpdate,
    onDeactivated,
    onErrorCaptured,
    onMounted,
    onRenderTracked,
    onRenderTriggered,
    onScopeDispose,
    onServerPrefetch,
    onUnmounted,
    onUpdated,
    watchEffect,
    watchPostEffect,
    watchSyncEffect
} from 'vue';


type Target = { new(...args: any[]): {} };
type Name = string | symbol;
type Callback = (...args: any[]) => any;
type HookCallback = (target: object, name: Name) => void;



const SETUP_OPTIONS_NAME = 'setupOptions';
const SETUP_NAME = 'setup';

class Hooks {
    activated = _registerHook(onActivated)
    beforeMount= _registerHook(onBeforeMount)
    beforeUnmount= _registerHook(onBeforeUnmount)
    beforeUpdate= _registerHook(onBeforeUpdate)
    deactivated= _registerHook(onDeactivated)
    errorCaptured= _registerHook(onErrorCaptured)
    mounted= _registerHook(onMounted)
    renderTracked= _registerHook(onRenderTracked)
    renderTriggered= _registerHook(onRenderTriggered)
    scopeDispose= _registerHook(onScopeDispose)
    serverPrefetch= _registerHook(onServerPrefetch)
    unmounted= _registerHook(onUnmounted)
    updated= _registerHook(onUpdated)
    watchPreEffect= _registerHook(watchEffect)
    watchPostEffect= _registerHook(watchPostEffect)
    watchSyncEffect= _registerHook(watchSyncEffect)
    computed(target: any, name: Name) {
        const descriptor = getDescriptor(target, name)!;
        compute(target, name, descriptor, 'get');
        compute(target, name, descriptor, 'value');
    }
    setup(target: any, name: Name) {
        target[name]();
    }
}
const HOOK = new Hooks();

type HookType = keyof Hooks;

function compute(target: any, name: Name, descriptor: PropertyDescriptor, type: 'get' | 'value') {
    if (typeof descriptor[type] !== 'function') return;

    const value = descriptor[type].bind(target);
    const compute = computed(value);
    Object.defineProperty(target, name, {
        ...descriptor,
        [type]() {
            return compute.value;
        }
    })
}


function getDescriptor(target: object, name: Name): PropertyDescriptor | null {
    const descriptor = Object.getOwnPropertyDescriptor(target, name);
    if (descriptor) {
        return descriptor;
    }
    const next = Object.getPrototypeOf(target);
    return getDescriptor(next, name);
}

function _registerHook(fn: Callback) {
    return (target: any, name: Name) => {
        fn(target[name]);
    }
}

function registerHook(name: HookType, fn: HookCallback) {
    HOOK[name] = fn;
}

const INIT_SETUP = '__initSetup'



function initHook(target: object) {

    const set = new Set<string>();
    const options = getOptions(target.constructor);
    Object.keys(options).forEach((hook: string) => {
        const names = options[hook];
        names.forEach((name: string) => {
            if (!set.has(name) && typeof target[name] === 'function') {
                target[name] = target[name].bind(target);
                set.add(name);
            }
            HOOK[hook](target, name);
        })
    });
}

let currentOptions: Partial<Record<HookType, string[]>> = {};

function getOptions(Target: any): Record<HookType, string[]> {
    let options = Target[SETUP_OPTIONS_NAME];
    if (!options) {
        options = {};
        Target[SETUP_OPTIONS_NAME] = options;
    }
    return options;
}

function setOptions(hook: string, name: Name) {
    const arr: Name[] = currentOptions[hook] = currentOptions[hook] || [];
    if (!arr.includes(name)) {
        arr.push(name);
    }
}

function getSetupOptions(Target: any) {
    const options = getOptions(Target);
    const temp = currentOptions;
    Object.keys(options).forEach(k => {
        const value = temp[k];
        if (Array.isArray(value)) {
            temp[k] = [...options[k], ...value];
        } else {
            temp[k] = [...options[k]];
        }
    })
    currentOptions = {}

    return temp;
}



function Setup<T extends Target>(Target: T) {
    const descriptors = Object.getOwnPropertyDescriptors(Target.prototype);

    Object.keys(descriptors).filter(k => {
        const descriptor = descriptors[k];
        if (descriptor.get) {
            setOptions('computed', k);
        }
    });
    class Setup extends Target {
        public static [SETUP_OPTIONS_NAME] = getSetupOptions(Target);
        public static [SETUP_NAME] = true;
        public constructor(...args: any[]) {
            super(...args);
            if (!this[INIT_SETUP]) {
                const target = reactive(this);
                initHook(target);
                Object.defineProperty(this, INIT_SETUP, {
                    value: true,
                    writable: false,
                    enumerable: false
                })
                // Vue3 needs to return, vue2 does not need to return
                return target;
            }
        }
    }

    return Setup
}

function Hook<T extends HookType>(hook: T) {
    return function (target: object, name: Name, descriptor: PropertyDescriptor) {
        setOptions(hook, name);
    }
}


export { Setup, Hook, type Hooks, type HookType, type HookCallback, registerHook }
"use strict";
// Copyright © SixtyFPS GmbH <info@slint.dev>
// SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-Slint-Royalty-free-1.1 OR LicenseRef-Slint-commercial
Object.defineProperty(exports, "__esModule", { value: true });
exports.quitEventLoop = exports.runEventLoop = exports.loadSource = exports.loadFile = exports.CompileError = exports.private_api = exports.ArrayModel = exports.Model = void 0;
const napi = require("./rust-module.cjs");
/**
 * Model<T> is the interface for feeding dynamic data into
 * `.slint` views.
 *
 * A model is organized like a table with rows of data. The
 * fields of the data type T behave like columns.
 *
 * @template T the type of the model's items.
 *
 * ### Example
 * As an example let's see the implementation of {@link ArrayModel}
 *
 * ```js
 * export class ArrayModel<T> extends Model<T> {
 *    private a: Array<T>
 *
 *   constructor(arr: Array<T>) {
 *        super();
 *        this.a = arr;
 *    }
 *
 *    rowCount() {
 *        return this.a.length;
 *    }
 *
 *    rowData(row: number) {
 *       return this.a[row];
 *    }
 *
 *    setRowData(row: number, data: T) {
 *        this.a[row] = data;
 *        this.notifyRowDataChanged(row);
 *    }
 *
 *    push(...values: T[]) {
 *        let size = this.a.length;
 *        Array.prototype.push.apply(this.a, values);
 *        this.notifyRowAdded(size, arguments.length);
 *    }
 *
 *    remove(index: number, size: number) {
 *        let r = this.a.splice(index, size);
 *        this.notifyRowRemoved(index, size);
 *    }
 *
 *    get length(): number {
 *        return this.a.length;
 *    }
 *
 *    values(): IterableIterator<T> {
 *        return this.a.values();
 *    }
 *
 *    entries(): IterableIterator<[number, T]> {
 *        return this.a.entries()
 *    }
 *}
 * ```
 */
class Model {
    /**
     * @hidden
     */
    notify;
    constructor() {
        this.notify = new NullPeer();
    }
    /**
     * Implementations of this function must store the provided data parameter
     * in the model at the specified row.
     * @param _row index in range 0..(rowCount() - 1).
     * @param _data new data item to store on the given row index
     */
    setRowData(_row, _data) {
        console.log("setRowData called on a model which does not re-implement this method. This happens when trying to modify a read-only model");
    }
    /**
     * Notifies the view that the data of the current row is changed.
     * @param row index of the changed row.
     */
    notifyRowDataChanged(row) {
        this.notify.rowDataChanged(row);
    }
    /**
     * Notifies the view that multiple rows are added to the model.
     * @param row index of the first added row.
     * @param count the number of added items.
     */
    notifyRowAdded(row, count) {
        this.notify.rowAdded(row, count);
    }
    /**
     * Notifies the view that multiple rows are removed to the model.
     * @param row index of the first removed row.
     * @param count the number of removed items.
     */
    notifyRowRemoved(row, count) {
        this.notify.rowRemoved(row, count);
    }
    /**
     * Notifies the view that the complete data must be reload.
     */
    notifyReset() {
        this.notify.reset();
    }
}
exports.Model = Model;
/**
 * @hidden
 */
class NullPeer {
    rowDataChanged(row) { }
    rowAdded(row, count) { }
    rowRemoved(row, count) { }
    reset() { }
}
/**
 * ArrayModel wraps a JavaScript array for use in `.slint` views. The underlying
 * array can be modified with the [[ArrayModel.push]] and [[ArrayModel.remove]] methods.
 */
class ArrayModel extends Model {
    /**
     * @hidden
     */
    #array;
    /**
     * Creates a new ArrayModel.
     *
     * @param arr
     */
    constructor(arr) {
        super();
        this.#array = arr;
    }
    /**
     * Returns the number of entries in the array model.
     */
    get length() {
        return this.#array.length;
    }
    /**
     * Returns the number of entries in the array model.
     */
    rowCount() {
        return this.#array.length;
    }
    /**
     * Returns the data at the specified row.
     * @param row index in range 0..(rowCount() - 1).
     * @returns undefined if row is out of range otherwise the data.
     */
    rowData(row) {
        return this.#array[row];
    }
    /**
     * Stores the given data on the given row index and notifies run-time about the changed row.
     * @param row index in range 0..(rowCount() - 1).
     * @param data new data item to store on the given row index
     */
    setRowData(row, data) {
        this.#array[row] = data;
        this.notifyRowDataChanged(row);
    }
    /**
     * Pushes new values to the array that's backing the model and notifies
     * the run-time about the added rows.
     * @param values list of values that will be pushed to the array.
     */
    push(...values) {
        let size = this.#array.length;
        Array.prototype.push.apply(this.#array, values);
        this.notifyRowAdded(size, arguments.length);
    }
    // FIXME: should this be named splice and have the splice api?
    /**
     * Removes the specified number of element from the array that's backing
     * the model, starting at the specified index.
     * @param index index of first row to remove.
     * @param size number of rows to remove.
     */
    remove(index, size) {
        let r = this.#array.splice(index, size);
        this.notifyRowRemoved(index, size);
    }
    /**
     * Returns an iterable of values in the array.
     */
    values() {
        return this.#array.values();
    }
    /**
     * Returns an iterable of key, value pairs for every entry in the array.
     */
    entries() {
        return this.#array.entries();
    }
}
exports.ArrayModel = ArrayModel;
var private_api;
(function (private_api) {
    /**
     * Provides rows that are generated by a map function based on the rows of another Model.
     *
     * @template T item type of source model that is mapped to U.
     * @template U the type of the mapped items
     *
     * ## Example
     *
     *  Here we have a {@link ArrayModel} holding rows of a custom interface `Name` and a {@link MapModel} that maps the name rows
     *  to single string rows.
     *
     * ```ts
     * import { Model, ArrayModel, MapModel } from "./index";
    *
    * interface Name {
    *     first: string;
    *     last: string;
    * }
    *
    * const model = new ArrayModel<Name>([
    *     {
    *         first: "Hans",
    *         last: "Emil",
    *     },
    *     {
    *         first: "Max",
    *         last: "Mustermann",
    *     },
    *     {
    *         first: "Roman",
    *         last: "Tisch",
    *     },
    * ]);
    *
    * const mappedModel = new MapModel(
    *     model,
    *     (data) => {
    *         return data.last + ", " + data.first;
    *     }
    * );
    *
    * // prints "Emil, Hans"
    * console.log(mappedModel.rowData(0));
    *
    * // prints "Mustermann, Max"
    * console.log(mappedModel.rowData(1));
    *
    * // prints "Tisch, Roman"
    * console.log(mappedModel.rowData(2));
    *
    * // Alternatively you can use the shortcut {@link MapModel.map}.
    *
    * const model = new ArrayModel<Name>([
    *     {
    *         first: "Hans",
    *         last: "Emil",
    *     },
    *     {
    *         first: "Max",
    *         last: "Mustermann",
    *     },
    *     {
    *         first: "Roman",
    *         last: "Tisch",
    *     },
    * ]);
    *
    * const mappedModel = model.map(
    *     (data) => {
    *         return data.last + ", " + data.first;
    *     }
    * );
    *
    *
    * // prints "Emil, Hans"
    * console.log(mappedModel.rowData(0));
    *
    * // prints "Mustermann, Max"
    * console.log(mappedModel.rowData(1));
    *
    * // prints "Tisch, Roman"
    * console.log(mappedModel.rowData(2));
    *
    * // You can modifying the underlying {@link ArrayModel}:
    *
    * const model = new ArrayModel<Name>([
    *     {
    *         first: "Hans",
    *         last: "Emil",
    *     },
    *     {
    *         first: "Max",
    *         last: "Mustermann",
    *     },
    *     {
    *         first: "Roman",
    *         last: "Tisch",
    *     },
    * ]);
    *
    * const mappedModel = model.map(
    *     (data) => {
    *         return data.last + ", " + data.first;
    *     }
    * );
    *
    * model.setRowData(1, { first: "Minnie", last: "Musterfrau" } );
    *
    * // prints "Emil, Hans"
    * console.log(mappedModel.rowData(0));
    *
    * // prints "Musterfrau, Minnie"
    * console.log(mappedModel.rowData(1));
    *
    * // prints "Tisch, Roman"
    * console.log(mappedModel.rowData(2));
    * ```
    */
    class MapModel extends Model {
        sourceModel;
        #mapFunction;
        /**
         * Constructs the MapModel with a source model and map functions.
         * @template T item type of source model that is mapped to U.
         * @template U the type of the mapped items.
         * @param sourceModel the wrapped model.
         * @param mapFunction maps the data from T to U.
         */
        constructor(sourceModel, mapFunction) {
            super();
            this.sourceModel = sourceModel;
            this.#mapFunction = mapFunction;
            this.notify = this.sourceModel.notify;
        }
        /**
         * Returns the number of entries in the model.
         */
        rowCount() {
            return this.sourceModel.rowCount();
        }
        /**
         * Returns the data at the specified row.
         * @param row index in range 0..(rowCount() - 1).
         * @returns undefined if row is out of range otherwise the data.
         */
        rowData(row) {
            return this.#mapFunction(this.sourceModel.rowData(row));
        }
    }
    private_api.MapModel = MapModel;
})(private_api || (exports.private_api = private_api = {}));
/**
 * @hidden
 */
class Component {
    #instance;
    /**
     * @hidden
     */
    constructor(instance) {
        this.#instance = instance;
    }
    get window() {
        return this.#instance.window();
    }
    /**
    * @hidden
    */
    get component_instance() {
        return this.#instance;
    }
    async run() {
        this.show();
        await runEventLoop();
        this.hide();
    }
    show() {
        this.#instance.window().show();
    }
    hide() {
        this.#instance.window().hide();
    }
}
/**
 * Represents an errors that can be emitted by the compiler.
 */
class CompileError extends Error {
    /**
     * List of {@link Diagnostic} items emitted while compiling .slint code.
     */
    diagnostics;
    /**
     * Creates a new CompileError.
     *
     * @param message human-readable description of the error.
     * @param diagnostics represent a list of diagnostic items emitted while compiling .slint code.
     */
    constructor(message, diagnostics) {
        super(message);
        this.diagnostics = diagnostics;
    }
}
exports.CompileError = CompileError;
function loadSlint(loadData) {
    const { filePath, options } = loadData.fileData;
    let compiler = new napi.ComponentCompiler();
    if (typeof options !== "undefined") {
        if (typeof options.style !== "undefined") {
            compiler.style = options.style;
        }
        if (typeof options.includePaths !== "undefined") {
            compiler.includePaths = options.includePaths;
        }
        if (typeof options.libraryPaths !== "undefined") {
            compiler.libraryPaths = options.libraryPaths;
        }
    }
    let definition = loadData.from === 'file' ? compiler.buildFromPath(filePath) : compiler.buildFromSource(loadData.fileData.source, filePath);
    let diagnostics = compiler.diagnostics;
    if (diagnostics.length > 0) {
        let warnings = diagnostics.filter((d) => d.level == napi.DiagnosticLevel.Warning);
        if (typeof options !== "undefined" && options.quiet !== true) {
            warnings.forEach((w) => console.warn("Warning: " + w));
        }
        let errors = diagnostics.filter((d) => d.level == napi.DiagnosticLevel.Error);
        if (errors.length > 0) {
            throw new CompileError("Could not compile " + filePath, errors);
        }
    }
    let slint_module = Object.create({});
    Object.defineProperty(slint_module, definition.name.replace(/-/g, "_"), {
        value: function (properties) {
            let instance = definition.create();
            if (instance == null) {
                throw Error("Could not create a component handle for" + filePath);
            }
            for (var key in properties) {
                let value = properties[key];
                if (value instanceof Function) {
                    instance.setCallback(key, value);
                }
                else {
                    instance.setProperty(key, properties[key]);
                }
            }
            let componentHandle = new Component(instance);
            instance.definition().properties.forEach((prop) => {
                let propName = prop.name.replace(/-/g, "_");
                if (componentHandle[propName] !== undefined) {
                    console.warn("Duplicated property name " + propName);
                }
                else {
                    Object.defineProperty(componentHandle, propName, {
                        get() {
                            return instance.getProperty(prop.name);
                        },
                        set(value) {
                            instance.setProperty(prop.name, value);
                        },
                        enumerable: true,
                    });
                }
            });
            instance.definition().callbacks.forEach((cb) => {
                let callbackName = cb.replace(/-/g, "_");
                if (componentHandle[callbackName] !== undefined) {
                    console.warn("Duplicated callback name " + callbackName);
                }
                else {
                    Object.defineProperty(componentHandle, cb.replace(/-/g, "_"), {
                        get() {
                            return function () {
                                return instance.invoke(cb, Array.from(arguments));
                            };
                        },
                        set(callback) {
                            instance.setCallback(cb, callback);
                        },
                        enumerable: true,
                    });
                }
            });
            // globals
            instance.definition().globals.forEach((globalName) => {
                if (componentHandle[globalName] !== undefined) {
                    console.warn("Duplicated property name " + globalName);
                }
                else {
                    let globalObject = Object.create({});
                    instance.definition().globalProperties(globalName).forEach((prop) => {
                        let propName = prop.name.replace(/-/g, "_");
                        if (globalObject[propName] !== undefined) {
                            console.warn("Duplicated property name " + propName + " on global " + global);
                        }
                        else {
                            Object.defineProperty(globalObject, propName, {
                                get() {
                                    return instance.getGlobalProperty(globalName, prop.name);
                                },
                                set(value) {
                                    instance.setGlobalProperty(globalName, prop.name, value);
                                },
                                enumerable: true,
                            });
                        }
                    });
                    instance.definition().globalCallbacks(globalName).forEach((cb) => {
                        let callbackName = cb.replace(/-/g, "_");
                        if (globalObject[callbackName] !== undefined) {
                            console.warn("Duplicated property name " + cb + " on global " + global);
                        }
                        else {
                            Object.defineProperty(globalObject, cb.replace(/-/g, "_"), {
                                get() {
                                    return function () {
                                        return instance.invokeGlobal(globalName, cb, Array.from(arguments));
                                    };
                                },
                                set(callback) {
                                    instance.setGlobalCallback(globalName, cb, callback);
                                },
                                enumerable: true,
                            });
                        }
                    });
                    Object.defineProperty(componentHandle, globalName, {
                        get() {
                            return globalObject;
                        },
                        enumerable: true,
                    });
                }
            });
            return Object.seal(componentHandle);
        },
    });
    return Object.seal(slint_module);
}
/**
 * Loads the given Slint file and returns an objects that contains a functions to construct the exported
 * component of the slint file.
 *
 * The following example loads a "Hello World" style Slint file and changes the Text label to a new greeting:
 * `main.slint`:
 * ```
 * export component Main {
 *     in-out property <string> greeting <=> label.text;
 *     label := Text {
 *         text: "Hello World";
 *     }
 * }
 * ```
 *
 * ```js
 * import * as slint from "slint-ui";
 * let ui = slint.loadFile("main.slint");
 * let main = new ui.Main();
 * main.greeting = "Hello friends";
 * ```
 *
 * @param filePath A path to the file to load. If the path is a relative path, then it is resolved
 *                 against the process' working directory.
 * @param options Use {@link LoadFileOptions} to configure additional Slint compilation aspects,
 *                such as include search paths, library imports, or the widget style.
 * @returns The returned object is sealed and provides a property by the name of the component exported
 *          in the `.slint` file. In the above example the name of the property is `Main`. The property
 *          is a constructor function. Use it with the new operator to instantiate the component.
 *          The instantiated object exposes properties and callbacks, and implements the {@link ComponentHandle} interface.
 *          For more details about the exposed properties, see [Instantiating A Component](../index.html#md:instantiating-a-component).
 * @throws {@link CompileError} if errors occur during compilation.
 */
function loadFile(filePath, options) {
    return loadSlint({
        fileData: { filePath, options },
        from: 'file',
    });
}
exports.loadFile = loadFile;
/**
 * Loads the given Slint source code and returns an object that contains a function to construct the exported
 * component of the Slint source code.
 *
 * The following example loads a "Hello World" style Slint source code and changes the Text label to a new greeting:
 * ```js
 * import * as slint from "slint-ui";
 * const source = `export component Main {
 *      in-out property <string> greeting <=> label.text;
 *      label := Text {
 *          text: "Hello World";
 *      }
 * }`; // The content of main.slint
 * let ui = slint.loadSource(source, "main.js");
 * let main = new ui.Main();
 * main.greeting = "Hello friends";
 * ```
 * @param source The Slint source code to load.
 * @param filePath A path to the file to show log. If the path is a relative path, then it is resolved
 *                 against the process' working directory.
 * @param options Use {@link LoadFileOptions} to configure additional Slint compilation aspects,
 *                such as include search paths, library imports, or the widget style.
 * @returns The returned object is sealed and provides a property by the name of the component exported
 *          in the `.slint` file. In the above example the name of the property is `Main`. The property
 *          is a constructor function. Use it with the new operator to instantiate the component.
 *          The instantiated object exposes properties and callbacks, and implements the {@link ComponentHandle} interface.
 *          For more details about the exposed properties, see [Instantiating A Component](../index.html#md:instantiating-a-component).
 * @throws {@link CompileError} if errors occur during compilation.
 */
function loadSource(source, filePath, options) {
    return loadSlint({
        fileData: { filePath, options, source },
        from: 'source',
    });
}
exports.loadSource = loadSource;
class EventLoop {
    #quit_loop = false;
    #terminationPromise = null;
    #terminateResolveFn;
    constructor() {
    }
    start(running_callback) {
        if (this.#terminationPromise != null) {
            return this.#terminationPromise;
        }
        this.#terminationPromise = new Promise((resolve) => {
            this.#terminateResolveFn = resolve;
        });
        this.#quit_loop = false;
        if (running_callback != undefined) {
            napi.invokeFromEventLoop(() => {
                running_callback();
                running_callback = undefined;
            });
        }
        // Give the nodejs event loop 16 ms to tick. This polling is sub-optimal, but it's the best we
        // can do right now.
        const nodejsPollInterval = 16;
        let id = setInterval(() => {
            if (napi.processEvents() == napi.ProcessEventsResult.Exited || this.#quit_loop) {
                clearInterval(id);
                this.#terminateResolveFn(undefined);
                this.#terminateResolveFn = null;
                this.#terminationPromise = null;
                return;
            }
        }, nodejsPollInterval);
        return this.#terminationPromise;
    }
    quit() {
        this.#quit_loop = true;
    }
}
var globalEventLoop = new EventLoop;
/**
 * Spins the Slint event loop and returns a promise that resolves when the loop terminates.
 *
 * If the event loop is already running, then this function returns the same promise as from
 * the earlier invocation.
 *
 * @param runningCallback Optional callback that's invoked once when the event loop is running.
 *                         The function's return value is ignored.
 *
 * Note that the event loop integration with Node.js is slightly imperfect. Due to conflicting
 * implementation details between Slint's and Node.js' event loop, the two loops are merged
 * by spinning one after the other, at 16 millisecond intervals. This means that when the
 * application is idle, it continues to consume a low amount of CPU cycles, checking if either
 * event loop has any pending events.
 */
function runEventLoop(runningCallback) {
    return globalEventLoop.start(runningCallback);
}
exports.runEventLoop = runEventLoop;
/**
 * Stops a spinning event loop. This function returns immediately, and the promise returned
 from run_event_loop() will resolve in a later tick of the nodejs event loop.
 */
function quitEventLoop() {
    globalEventLoop.quit();
}
exports.quitEventLoop = quitEventLoop;
/**
 * @hidden
 */
(function (private_api) {
    private_api.mock_elapsed_time = napi.mockElapsedTime;
    private_api.get_mocked_time = napi.getMockedTime;
    private_api.ComponentCompiler = napi.ComponentCompiler;
    private_api.ComponentDefinition = napi.ComponentDefinition;
    private_api.ComponentInstance = napi.ComponentInstance;
    private_api.ValueType = napi.ValueType;
    private_api.Window = napi.Window;
    private_api.SlintBrush = napi.SlintBrush;
    private_api.SlintRgbaColor = napi.SlintRgbaColor;
    private_api.SlintSize = napi.SlintSize;
    private_api.SlintPoint = napi.SlintPoint;
    private_api.SlintImageData = napi.SlintImageData;
    function send_mouse_click(component, x, y) {
        component.component_instance.sendMouseClick(x, y);
    }
    private_api.send_mouse_click = send_mouse_click;
    function send_mouse_double_click(component, x, y) {
        component.component_instance.sendMouseDoubleClick(x, y);
    }
    private_api.send_mouse_double_click = send_mouse_double_click;
    function send_keyboard_string_sequence(component, s) {
        component.component_instance.sendKeyboardStringSequence(s);
    }
    private_api.send_keyboard_string_sequence = send_keyboard_string_sequence;
})(private_api || (exports.private_api = private_api = {}));

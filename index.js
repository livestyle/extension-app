'use strict';

import {createStore, applyMiddleware} from 'redux';
import createLogger from 'redux-logger';
import reducers from './lib/reducers';
import {deepGet, iterate} from './lib/utils';

export default function createApp(client, options={}) {
    var middlewares = [];
    if (options.logger) {
        middlewares.push(createLogger({collapsed: true}));
    }

    // @see README.md for model reference
    const store = createStore(reducers, {
        editors: {
            list: new Map(),
            files: new Set()
        },
        tabs: new Map(),
        sessions: new Map(),
        pages: new Map(),
        removeView: {
            connected: false,
            sessions: new Map()
        }
    }, applyMiddleware(...middlewares));

    return {
        /**
         * Send message to update store
         * @param  {Object} data Message payload
         */
        dispatch(data) {
            return store.dispatch(data);
        },

        /**
         * Subscribe to store updates
         * @param  {Function} onChange Callback to invoke when store changes
         * @param  {Function|String} select   Function to check if required data
         * was changed in next state or deep key (string)
         * @return {Function} Function that will unsubscribe current listener
         */
        subscribe(onChange, select) {
            let currentState;
            return store.subscribe(() => {
                let nextState = getState();
                if (typeof select === 'function') {
                    nextState = select(nextState);
                } else if (typeof select === 'string') {
                    // watching for a specific key in store
                    nextState = getStateValue(select, nextState);
                }
                if (nextState !== currentState) {
                    currentState = nextState;
                    onChange(currentState);
                }
            });
        },

        /**
         * Same as `subscribe` but will walk on each value of object retrieved
         * by `rootKey` and check if `innerKey` was changed in this value. Will
         * invoke `onChange` for every changed value of `rootKey` object.
         * Useful for detecting changes in runtime objects, e.g. objects with
         * unknown keys.
         * @param  {String} rootKey
         * @param  {String} innerKey
         * @param  {Function} onChange
         * @return {Function} Function that will unsubscribe current listener
         */
        subscribeDeepKey(rootKey, innerKey, onChange) {
            if (typeof innerKey === 'function') {
                [onChange, innerKey] = [innerKey, null];
            }

            let currentState = {};
            return store.subscribe(() => {
                let nextState = getStateValue(rootKey);
                // find out which object were updated and invoke `onChange`
                // handler for each
                if (currentState !== nextState) {
                    iterate(nextState, (next, key) => {
                        let cur = currentState[key];
                        if (cur == null || cur !== next) {
                            if (innerKey) {
                                // invoke handler only if specified key was updated
                                let prevValue = cur ? deepGet(cur, innerKey) : undefined;
                                let nextValue = next ? deepGet(next, innerKey) : undefined;
                                currentState = nextState;
                                if (prevValue !== nextValue) {
                                    onChange(next, key, nextValue, prevValue, innerKey);
                                }
                            } else {
                                currentState = nextState;
                                onChange(next, key);
                            }
                        }
                    });
                }
            });
        },

        getState() {
            return store.getState();
        },

        getStateValue(key, state=getState()) {
            return deepGet(state, key);
        }
    };
};

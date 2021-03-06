import { callAutomation, callService } from "@/mqtt";
import { Http } from "@/services/http.service";
import find from "ramda/es/find";
import propEq from "ramda/es/propEq";
import transpose from "ramda/es/transpose";
import splitEvery from "ramda/es/splitEvery";

const SET_ENTITIES = "setEntities";
const SET_ENTITY = "setEntity";
const ADD_ENTITY = "addEntity";
const SET_STATES = "setStates";
const SET_ONLINE = "setOnline";
const SET_LOGS = "setLogs";
const SET_STATE = "setState";
const SET_LOADING = "setLoading";

const state = {
  list: [],
  statePool: {},
  onlinePool: {},
  logs: {},
  loadingLogs: true
};
const getters = {
  grouped: state => {
    return state.list.reduce((prev, next) => {
      if (next.group) {
        prev[next.group] = prev[next.group] || [];
        prev[next.group].push(next);
      } else {
        prev[next.type] = prev[next.type] || [];
        prev[next.type].push(next);
      }
      return prev;
    }, {});
  },
  columnGroup: (_state, getters) => {
    return transpose(splitEvery(4, Object.keys(getters.grouped)));
  },
  entityById: state => {
    return (id: string) => {
      return find(propEq("entityId", id))(state.list);
    };
  }
};
const mutations = {
  [SET_ENTITIES]: (state, entities) => {
    state.list = entities;
  },
  [SET_ENTITY]: (state, entity) => {
    state.list = state.list.map(e => {
      if (e._id === entity._id) {
        return entity;
      }
      return e;
    });
  },
  [ADD_ENTITY]: (state, entity) => {
    state.list = state.list.concat(entity);
  },
  [SET_STATES]: (state, pool) => {
    state.statePool = pool;
  },
  [SET_ONLINE]: (state, pool) => {
    state.onlinePool = pool;
  },
  [SET_LOGS]: (state, { entityId, logs }) => {
    state.logs[entityId] = logs;
    state.loadingLogs = false;
  },
  [SET_STATE]: (state, { entityId, newState }) => {
    state.statePool[entityId] = newState;
  },
  [SET_LOADING]: (state, loading) => {
    state.loadingLogs = loading;
  }
};

const actions = {
  fetchEntities: async ({ commit }) => {
    try {
      const { data: entities } = await Http.get("entities");
      let { data: automations } = await Http.get("entities/automations");
      const { data: statePool } = await Http.get("entities/states");
      const { data: onlinePool } = await Http.get("entities/online");

      automations = automations.map(a => {
        return {
          ...a,
          entityId: a._id
        };
      });

      commit(SET_ENTITIES, entities.concat(automations));
      commit(SET_STATES, statePool);
      commit(SET_ONLINE, onlinePool);
    } catch (e) {
      console.log(e);
    }
  },
  fetchLogs: async ({ commit }, entityId: string) => {
    try {
      commit(SET_LOADING, true);
      const { data: logs } = await Http.get(`entities/logs/${entityId}`);
      commit(SET_LOGS, { entityId, logs });
      commit(SET_LOADING, false);
    } catch (e) {
      console.log(e);
    }
  },

  updateSettings: async ({ commit }, entity) => {
    try {
      const url = `entities/${entity.type === "automation" ? "automation/" : ""}${entity._id}`;
      const { data } = await Http.put(url, Object.freeze(entity));
      commit(SET_ENTITY, data);
    } catch (e) {
      console.log(e);
    }
  },

  addAutomation: async ({ commit }, name) => {
    try {
      const url = `entities/automations`;
      const { data } = await Http.post(url, {name});
      commit(ADD_ENTITY, data);
    } catch (e) {
      console.log(e);
    }
  },

  toggleDevice: ({ state }, entity) => {
    const service = state.statePool[entity.entityId].state ? "turnOff" : "turnOn";
    callService(entity.entityId, service).subscribe();
  },

  toggleAutomation: ({ state }, entity) => {
    const targetState = state.statePool[entity.entityId] ? !state.statePool[entity.entityId].state : false;
    callAutomation(entity.entityId, targetState).subscribe();
  },

  addCondition: async ({ commit }, { id, type, condition }) => {
    try {
      const url = `entities/automation/${id}/${type}`;
      const { data } = await Http.put(url, Object.freeze(condition));
      commit(SET_ENTITY, data);
    } catch (e) {
      console.log(e);
    }
  },

  removeCondition: async ({ commit }, { id, type, entityId }) => {
    try {
      const url = `entities/automation/${id}/${type}`;
      const { data } = await Http.delete(url, { data: {entityId}});
      commit(SET_ENTITY, data);
    } catch (e) {
      console.log(e);
    }
  },
};

export const entities = {
  namespaced: true,
  state,
  getters,
  mutations,
  actions,
};

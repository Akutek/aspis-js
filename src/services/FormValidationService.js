/** @typedef {import("../types/services.js").FieldRules} FieldRules */
/** @typedef {import("../types/services.js").FormErrors} FormErrors */
/** @typedef {import("../types/services.js").FormSchema} FormSchema */
/** @typedef {import("../types/services.js").FormValues} FormValues */
/** @typedef {import("../types/services.js").RuleConfigObject} RuleConfigObject */
/** @typedef {import("../types/services.js").ValidationRuleFn} ValidationRuleFn */
class FormValidationService {
  static #rules = {
    required: (value) => {
      if (value === null || value === void 0) return false;
      if (typeof value === "string") return value.trim().length > 0;
      if (Array.isArray(value)) return value.length > 0;
      return true;
    },
    email: (value) => {
      if (!value) return true;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value));
    },
    minLength: (value, param) => {
      if (!value) return true;
      return String(value).length >= Number(param);
    },
    maxLength: (value, param) => {
      if (!value) return true;
      return String(value).length <= Number(param);
    },
    numeric: (value) => {
      if (!value) return true;
      const numeric = Number(value);
      return !Number.isNaN(numeric) && Number.isFinite(numeric);
    },
    pattern: (value, param) => {
      if (!value) return true;
      const regex = new RegExp(String(param));
      return regex.test(String(value));
    }
  };
  static registerRule(name, fn) {
    if (typeof fn === "function") {
      this.#rules[name] = fn;
    }
  }
  static validateField(value, rules = {}) {
    for (const [ruleName, config] of Object.entries(rules)) {
      let param = null;
      let message = "Ung\xFCltiger Wert";
      if (Array.isArray(config)) {
        [param, message] = config;
      } else if (typeof config === "string") {
        message = config;
      } else if (typeof config === "object" && config !== null) {
        const ruleConfig = config;
        param = ruleConfig.param;
        message = ruleConfig.message || message;
      }
      const ruleFn = this.#rules[ruleName];
      if (ruleFn && !ruleFn(value, param)) {
        return message;
      }
    }
    return null;
  }
  static validateForm(values, schema = {}) {
    const errors = {};
    for (const [fieldName, rules] of Object.entries(schema)) {
      const fieldValue = values[fieldName];
      const error = this.validateField(fieldValue, rules);
      if (error) {
        errors[fieldName] = error;
      }
    }
    return errors;
  }
}
export {
  FormValidationService
};

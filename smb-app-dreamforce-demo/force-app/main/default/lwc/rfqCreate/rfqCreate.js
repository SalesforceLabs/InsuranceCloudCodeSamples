import { LightningElement, track } from 'lwc';
import {
    LOBS,
    ITEM_TYPES,
    typesForLob,
    COVERAGE_CATALOG,
    coveragesForTarget,
    POLICY_TARGET,
    MOCK_ACCOUNTS
} from 'c/rfqConstants';

const STEPS = [
    { num: 1, label: 'Create RFQ' },
    { num: 2, label: 'Publish to Carriers' },
    { num: 3, label: 'Compare Quotes' },
    { num: 4, label: 'Bind Policy' }
];

function uid() {
    return (crypto && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

function moneyFormat(n) {
    const num = Number(n) || 0;
    return num.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function todayPlus(months) {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    return d.toISOString().slice(0, 10);
}

export default class RfqCreate extends LightningElement {
    rfqNumber = `RFQ-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;

    @track insured = null;
    @track primaryContact = '';
    @track contactEmail = '';
    @track lob = 'property';
    @track effectiveDate = todayPlus(0);
    @track expirationDate = todayPlus(12);
    @track responseDeadline = todayPlus(0);
    @track notes = '';

    @track lineItems = [];
    @track coverages = { [POLICY_TARGET]: [] };

    @track insuredSearch = '';
    @track showInsuredResults = false;

    @track lineItemModalOpen = false;
    @track coverageModalOpen = false;

    @track editingLineItem = null;
    @track editingCoverage = null;
    @track coverageTargetId = POLICY_TARGET;

    steps = STEPS;
    lobOptions = LOBS;

    // ─────────────────────────────────────────────────────────────
    // Header / status
    // ─────────────────────────────────────────────────────────────
    get rfqTitle() {
        return this.insured ? `${this.insured.name} — ${this.lobLabel}` : 'New RFQ';
    }

    get rfqStatusLabel() {
        return 'Draft';
    }

    get lobLabel() {
        const found = LOBS.find(l => l.value === this.lob);
        return found ? found.title : '';
    }

    get pathSteps() {
        return STEPS.map(s => ({
            ...s,
            classes: s.num === 1
                ? 'rfq-path__step rfq-path__step--current'
                : 'rfq-path__step'
        }));
    }

    get lobCards() {
        return LOBS.map(l => ({
            ...l,
            selected: this.lob === l.value,
            classes: this.lob === l.value ? 'rfq-radio-card rfq-radio-card--selected' : 'rfq-radio-card',
            iconStyle: `background:${l.accent}`
        }));
    }

    // ─────────────────────────────────────────────────────────────
    // Insured lookup
    // ─────────────────────────────────────────────────────────────
    get insuredResults() {
        const q = (this.insuredSearch || '').trim().toLowerCase();
        const base = q
            ? MOCK_ACCOUNTS.filter(a => a.name.toLowerCase().includes(q) || a.city.toLowerCase().includes(q))
            : MOCK_ACCOUNTS;
        return base.slice(0, 6);
    }

    get hasInsured() {
        return !!this.insured;
    }

    handleInsuredInput(event) {
        this.insuredSearch = event.target.value;
        this.showInsuredResults = true;
    }

    handleInsuredFocus() {
        this.showInsuredResults = true;
    }

    handleInsuredBlur() {
        // delay to allow click to register on a result row
        setTimeout(() => { this.showInsuredResults = false; }, 150);
    }

    selectInsured(event) {
        const id = event.currentTarget.dataset.id;
        const acc = MOCK_ACCOUNTS.find(a => a.id === id);
        if (acc) {
            this.insured = acc;
            this.insuredSearch = '';
            this.showInsuredResults = false;
        }
    }

    clearInsured() {
        this.insured = null;
    }

    // ─────────────────────────────────────────────────────────────
    // LoB
    // ─────────────────────────────────────────────────────────────
    selectLob(event) {
        const next = event.currentTarget.dataset.value;
        if (next === this.lob) return;
        this.lob = next;
        // Drop line items + non-applicable coverages that don't belong to the new LoB.
        this.lineItems = this.lineItems.filter(li => ITEM_TYPES[li.type].lob.includes(next));
        // Coverage cleanup: keep policy coverages, drop line-item coverages whose target no longer exists.
        const validTargets = new Set([POLICY_TARGET, ...this.lineItems.map(li => li.id)]);
        const next$ = {};
        Object.keys(this.coverages).forEach(t => {
            if (validTargets.has(t)) next$[t] = this.coverages[t];
        });
        this.coverages = next$;
    }

    // ─────────────────────────────────────────────────────────────
    // Line items — tree (flattened with depth)
    // ─────────────────────────────────────────────────────────────
    get availableItemTypes() {
        return typesForLob(this.lob);
    }

    get hasLineItems() {
        return this.lineItems.length > 0;
    }

    get flattenedLineItems() {
        const byParent = new Map();
        this.lineItems.forEach(li => {
            const parent = li.parentId || null;
            if (!byParent.has(parent)) byParent.set(parent, []);
            byParent.get(parent).push(li);
        });
        const out = [];
        const walk = (parent, depth) => {
            (byParent.get(parent) || []).forEach(li => {
                const type = ITEM_TYPES[li.type];
                const value = Number(li.fields.value || 0) + Number(li.fields.contentsValue || 0);
                out.push({
                    ...li,
                    depth,
                    indentStyle: `padding-left:${0.75 + depth * 1.5}rem`,
                    typeLabel: type.label,
                    displayName: li.fields.name || li.fields.address || `(unnamed ${type.label})`,
                    displayValue: value > 0 ? moneyFormat(value) : '—',
                    coverageCount: (this.coverages[li.id] || []).length
                });
                walk(li.id, depth + 1);
            });
        };
        walk(null, 0);
        return out;
    }

    get totalInsuredValue() {
        const sum = this.lineItems.reduce((acc, li) => {
            return acc + Number(li.fields.value || 0) + Number(li.fields.contentsValue || 0);
        }, 0);
        return moneyFormat(sum);
    }

    openAddLineItem() {
        this.editingLineItem = {
            id: null,
            type: this.availableItemTypes[0]?.key || 'location',
            parentId: '',
            fields: {}
        };
        this.lineItemModalOpen = true;
    }

    editLineItem(event) {
        const id = event.currentTarget.dataset.id;
        const li = this.lineItems.find(l => l.id === id);
        if (!li) return;
        this.editingLineItem = {
            id: li.id,
            type: li.type,
            parentId: li.parentId || '',
            fields: { ...li.fields }
        };
        this.lineItemModalOpen = true;
    }

    removeLineItem(event) {
        const id = event.currentTarget.dataset.id;
        // Cascade: remove this line item plus its descendants.
        const toRemove = new Set([id]);
        let changed = true;
        while (changed) {
            changed = false;
            this.lineItems.forEach(li => {
                if (li.parentId && toRemove.has(li.parentId) && !toRemove.has(li.id)) {
                    toRemove.add(li.id);
                    changed = true;
                }
            });
        }
        this.lineItems = this.lineItems.filter(li => !toRemove.has(li.id));
        const nextCov = {};
        Object.keys(this.coverages).forEach(t => {
            if (!toRemove.has(t)) nextCov[t] = this.coverages[t];
        });
        this.coverages = nextCov;
    }

    closeLineItemModal() {
        this.lineItemModalOpen = false;
        this.editingLineItem = null;
    }

    handleLineItemTypeChange(event) {
        const next = event.currentTarget.dataset.value;
        if (!this.editingLineItem) return;
        this.editingLineItem = { ...this.editingLineItem, type: next, parentId: '', fields: {} };
    }

    get lineItemModalTitle() {
        const verb = this.editingLineItem && this.editingLineItem.id ? 'Edit' : 'Add';
        return `${verb} Line Item`;
    }

    handleLineItemFieldChange(event) {
        const key = event.target.dataset.key;
        const value = event.target.value;
        this.editingLineItem = {
            ...this.editingLineItem,
            fields: { ...this.editingLineItem.fields, [key]: value }
        };
    }

    handleLineItemParentChange(event) {
        this.editingLineItem = { ...this.editingLineItem, parentId: event.target.value };
    }

    saveLineItem() {
        if (!this.editingLineItem) return;
        const { id, type, parentId, fields } = this.editingLineItem;
        // basic required-field check
        const def = ITEM_TYPES[type];
        const missing = def.fields.filter(f => f.required && !fields[f.key]);
        if (missing.length) {
            // eslint-disable-next-line no-alert
            alert(`Missing required fields: ${missing.map(f => f.label).join(', ')}`);
            return;
        }
        if (id) {
            this.lineItems = this.lineItems.map(li =>
                li.id === id ? { ...li, type, parentId: parentId || null, fields: { ...fields } } : li
            );
        } else {
            this.lineItems = [
                ...this.lineItems,
                { id: uid(), type, parentId: parentId || null, fields: { ...fields } }
            ];
        }
        this.closeLineItemModal();
    }

    // Renderable form fields for the line-item modal.
    get lineItemFormFields() {
        if (!this.editingLineItem) return [];
        const def = ITEM_TYPES[this.editingLineItem.type];
        return def.fields.map(f => this.decorateField(f, this.editingLineItem.fields[f.key]));
    }

    get lineItemTypeCards() {
        if (!this.editingLineItem) return [];
        return this.availableItemTypes.map(t => ({
            ...t,
            selected: this.editingLineItem.type === t.key,
            classes: this.editingLineItem.type === t.key
                ? 'rfq-type-card rfq-type-card--selected'
                : 'rfq-type-card'
        }));
    }

    get lineItemParentOptions() {
        if (!this.editingLineItem) return [];
        const def = ITEM_TYPES[this.editingLineItem.type];
        const allowed = def.allowedParents || [];
        const canTopLevel = allowed.includes(null);
        const candidates = this.lineItems.filter(li =>
            allowed.includes(li.type) && li.id !== this.editingLineItem.id
        );
        const opts = [];
        if (canTopLevel) opts.push({ value: '', label: '— None (top level) —' });
        candidates.forEach(li => {
            opts.push({ value: li.id, label: `${ITEM_TYPES[li.type].label}: ${li.fields.name || li.fields.address || '(unnamed)'}` });
        });
        return opts;
    }

    get showParentRow() {
        if (!this.editingLineItem) return false;
        const def = ITEM_TYPES[this.editingLineItem.type];
        const allowed = def.allowedParents || [];
        return !(allowed.length === 1 && allowed[0] === null);
    }

    // ─────────────────────────────────────────────────────────────
    // Coverages
    // ─────────────────────────────────────────────────────────────
    get policyCoverages() {
        return this.renderableCoverages(POLICY_TARGET);
    }

    renderableCoverages(targetId) {
        const list = this.coverages[targetId] || [];
        return list.map(c => {
            const def = COVERAGE_CATALOG[c.key];
            return {
                ...c,
                name: def.name,
                code: def.code,
                form: def.form,
                accent: def.accent,
                accentStyle: `border-left:3px solid ${def.accent}`,
                summary: this.coverageSummary(def, c.values)
            };
        });
    }

    coverageSummary(def, values) {
        const parts = def.fields
            .filter(f => values[f.key] !== undefined && values[f.key] !== '')
            .map(f => `${f.label}: ${f.isMoney ? moneyFormat(values[f.key]) : values[f.key]}`);
        return parts.join(' · ');
    }

    openAddPolicyCoverage() {
        this.coverageTargetId = POLICY_TARGET;
        this.openCoverageModalForTarget();
    }

    openCoverageModalForTarget() {
        const available = coveragesForTarget(this.coverageTargetId);
        if (!available.length) return;
        const first = available[0];
        const defaults = {};
        first.fields.forEach(f => { if (f.default !== undefined) defaults[f.key] = f.default; });
        this.editingCoverage = { id: null, key: first.key, values: defaults };
        this.coverageModalOpen = true;
    }

    closeCoverageModal() {
        this.coverageModalOpen = false;
        this.editingCoverage = null;
    }

    handleCoverageTypeChange(event) {
        const key = event.currentTarget.dataset.value;
        const def = COVERAGE_CATALOG[key];
        const defaults = {};
        def.fields.forEach(f => { if (f.default !== undefined) defaults[f.key] = f.default; });
        this.editingCoverage = { ...this.editingCoverage, key, values: defaults };
    }

    handleCoverageFieldChange(event) {
        const key = event.target.dataset.key;
        const value = event.target.value;
        this.editingCoverage = {
            ...this.editingCoverage,
            values: { ...this.editingCoverage.values, [key]: value }
        };
    }

    saveCoverage() {
        if (!this.editingCoverage) return;
        const def = COVERAGE_CATALOG[this.editingCoverage.key];
        const missing = def.fields.filter(f => f.required && !this.editingCoverage.values[f.key]);
        if (missing.length) {
            // eslint-disable-next-line no-alert
            alert(`Missing required fields: ${missing.map(f => f.label).join(', ')}`);
            return;
        }
        const target = this.coverageTargetId;
        const list = this.coverages[target] ? [...this.coverages[target]] : [];
        list.push({
            id: uid(),
            key: this.editingCoverage.key,
            values: { ...this.editingCoverage.values }
        });
        this.coverages = { ...this.coverages, [target]: list };
        this.closeCoverageModal();
    }

    removePolicyCoverage(event) {
        const id = event.currentTarget.dataset.id;
        const list = (this.coverages[POLICY_TARGET] || []).filter(c => c.id !== id);
        this.coverages = { ...this.coverages, [POLICY_TARGET]: list };
    }

    get coverageTypeCards() {
        if (!this.editingCoverage) return [];
        const available = coveragesForTarget(this.coverageTargetId);
        return available.map(c => ({
            key: c.key,
            name: c.name,
            description: c.description,
            code: c.code,
            form: c.form,
            accent: c.accent,
            accentStyle: `border-left:3px solid ${c.accent}`,
            selected: this.editingCoverage.key === c.key,
            classes: this.editingCoverage.key === c.key
                ? 'rfq-coverage-card rfq-coverage-card--selected'
                : 'rfq-coverage-card'
        }));
    }

    get coverageFormFields() {
        if (!this.editingCoverage) return [];
        const def = COVERAGE_CATALOG[this.editingCoverage.key];
        return def.fields.map(f => this.decorateField(f, this.editingCoverage.values[f.key]));
    }

    get coverageModalTitle() {
        if (!this.editingCoverage) return 'Add Coverage';
        const def = COVERAGE_CATALOG[this.editingCoverage.key];
        return `Add ${def.name}`;
    }

    // ─────────────────────────────────────────────────────────────
    // Shared field rendering helper
    // ─────────────────────────────────────────────────────────────
    decorateField(field, value) {
        const isText = field.type === 'text';
        const isNumber = field.type === 'number';
        const isSelect = field.type === 'select';
        const isDate = field.type === 'date';
        return {
            ...field,
            value: value ?? field.default ?? '',
            isText,
            isNumber,
            isSelect,
            isDate,
            spanClass: field.span === 2 ? 'rfq-field rfq-field--span2' : 'rfq-field',
            selectOptions: isSelect
                ? (field.options || []).map(o => ({ value: o, label: o || '— Select —' }))
                : []
        };
    }

    // ─────────────────────────────────────────────────────────────
    // Form-level field handlers
    // ─────────────────────────────────────────────────────────────
    handleHeaderField(event) {
        const field = event.target.dataset.field;
        this[field] = event.target.value;
    }

    // ─────────────────────────────────────────────────────────────
    // Actions
    // ─────────────────────────────────────────────────────────────
    saveDraft() {
        this.dispatchEvent(new CustomEvent('savedraft', {
            detail: this.snapshot()
        }));
    }

    cancel() {
        this.dispatchEvent(new CustomEvent('cancel'));
    }

    goNext() {
        if (!this.insured) {
            // eslint-disable-next-line no-alert
            alert('Please select an Insured account before continuing.');
            return;
        }
        if (!this.lineItems.length) {
            // eslint-disable-next-line no-alert
            alert('Add at least one line item to describe what is being insured.');
            return;
        }
        this.dispatchEvent(new CustomEvent('next', { detail: this.snapshot() }));
    }

    snapshot() {
        return {
            rfqNumber: this.rfqNumber,
            insured: this.insured,
            primaryContact: this.primaryContact,
            contactEmail: this.contactEmail,
            lob: this.lob,
            effectiveDate: this.effectiveDate,
            expirationDate: this.expirationDate,
            responseDeadline: this.responseDeadline,
            notes: this.notes,
            lineItems: this.lineItems,
            coverages: this.coverages
        };
    }
}

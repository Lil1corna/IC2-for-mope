/**
 * Mock for @minecraft/server-ui module
 * Used for testing GUI components without Minecraft runtime
 */

export class ActionFormData {
    private _title: string = '';
    private _body: string = '';
    private _buttons: string[] = [];

    title(title: string): this {
        this._title = title;
        return this;
    }

    body(body: string): this {
        this._body = body;
        return this;
    }

    button(text: string, iconPath?: string): this {
        this._buttons.push(text);
        return this;
    }

    async show(player: any): Promise<ActionFormResponse> {
        return {
            canceled: false,
            selection: 0
        };
    }
}

export interface ActionFormResponse {
    canceled: boolean;
    selection?: number;
}

export class ModalFormData {
    private _title: string = '';
    private _elements: any[] = [];

    title(title: string): this {
        this._title = title;
        return this;
    }

    slider(label: string, min: number, max: number, step: number, defaultValue?: number): this {
        this._elements.push({ type: 'slider', label, min, max, step, defaultValue });
        return this;
    }

    textField(label: string, placeholder: string, defaultValue?: string): this {
        this._elements.push({ type: 'textField', label, placeholder, defaultValue });
        return this;
    }

    dropdown(label: string, options: string[], defaultIndex?: number): this {
        this._elements.push({ type: 'dropdown', label, options, defaultIndex });
        return this;
    }

    toggle(label: string, defaultValue?: boolean): this {
        this._elements.push({ type: 'toggle', label, defaultValue });
        return this;
    }

    async show(player: any): Promise<ModalFormResponse> {
        return {
            canceled: false,
            formValues: [1]
        };
    }
}

export interface ModalFormResponse {
    canceled: boolean;
    formValues?: (string | number | boolean)[];
}

export class MessageFormData {
    private _title: string = '';
    private _body: string = '';
    private _button1: string = '';
    private _button2: string = '';

    title(title: string): this {
        this._title = title;
        return this;
    }

    body(body: string): this {
        this._body = body;
        return this;
    }

    button1(text: string): this {
        this._button1 = text;
        return this;
    }

    button2(text: string): this {
        this._button2 = text;
        return this;
    }

    async show(player: any): Promise<MessageFormResponse> {
        return {
            canceled: false,
            selection: 0
        };
    }
}

export interface MessageFormResponse {
    canceled: boolean;
    selection?: number;
}

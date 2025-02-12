import {
    convertErrorToCopiableValue,
    convertToCopiableValue,
    embedBase64InPdf,
    ensureBotIsSerializable,
    ensureTagIsSerializable,
    formatAuthToken,
    fromHexString,
    getEmbeddedBase64FromPdf,
    isPromise,
    parseAuthToken,
    toHexString,
} from './Utils';
import './BlobPolyfill';
import { createDummyRuntimeBot } from './test/TestScriptBotFactory';
import { DateTime } from 'luxon';
import { Vector2, Vector3, Rotation } from '../math';
import { createBot, ORIGINAL_OBJECT } from '../bots';
import {
    allDataTypeCases,
    customDataTypeCases,
} from './test/RuntimeTestHelpers';

describe('convertErrorToCopiableValue()', () => {
    it('should convert error objects into an object with message and name', () => {
        const err1 = new Error('abc');
        const err2 = new SyntaxError('def');

        expect(convertErrorToCopiableValue(err1)).toEqual({
            name: 'Error',
            message: 'abc',
            stack: expect.any(String),
        });
        expect(convertErrorToCopiableValue(err2)).toEqual({
            name: 'SyntaxError',
            message: 'def',
            stack: expect.any(String),
        });
    });

    it('should include a cut-down version of the response object stored in the error', () => {
        const err1 = new Error('abc') as any;
        err1.response = {
            extra: 'wrong',
            data: { abc: 'def' },
            headers: { header1: true },
            status: 500,
            statusText: '',
        };

        expect(convertErrorToCopiableValue(err1)).toEqual({
            name: 'Error',
            message: 'abc',
            stack: expect.any(String),
            response: {
                data: { abc: 'def' },
                headers: { header1: true },
                status: 500,
                statusText: '',
            },
        });
    });
});

describe('convertToCopiableValue()', () => {
    it('should leave strings alone', () => {
        const result = convertToCopiableValue('test');
        expect(result).toBe('test');
    });

    it('should leave numbers alone', () => {
        const result = convertToCopiableValue(0.23);
        expect(result).toBe(0.23);
    });

    it('should leave booleans alone', () => {
        const result = convertToCopiableValue(true);
        expect(result).toBe(true);
    });

    it('should leave simple objects alone', () => {
        const obj = {
            test: 'abc',
        };
        const result = convertToCopiableValue(obj);
        expect(result).toEqual(obj);
    });

    it('should leave arrays alone', () => {
        const arr = ['abc'];
        const result = convertToCopiableValue(arr);
        expect(result).toEqual(arr);
    });

    it('should leave nulls alone', () => {
        const result = convertToCopiableValue(null);
        expect(result).toBe(null);
    });

    it('should leave dates alone', () => {
        const result = convertToCopiableValue(new Date(2021, 10, 14));
        expect(result).toEqual(new Date(2021, 10, 14));
    });

    it('should leave undefined alone', () => {
        const result = convertToCopiableValue(undefined);
        expect(result).toBeUndefined();
    });

    it('should leave Blobs alone', () => {
        const value = new Blob(['abc']);
        const result = convertToCopiableValue(value);
        expect(result).toBe(value);
    });

    it('should leave ArrayBuffer objects alone', () => {
        const value = new ArrayBuffer(10);
        const result = convertToCopiableValue(value);
        expect(result).toBe(value);
    });

    const viewCases = [
        ['Uint8Array', new Uint8Array(20)] as const,
        ['Uint16Array', new Uint16Array(20)] as const,
        ['Uint32Array', new Uint32Array(20)] as const,
        ['Int8Array', new Int8Array(20)] as const,
        ['Int16Array', new Int16Array(20)] as const,
        ['Int32Array', new Int32Array(20)] as const,
        ['Float32Array', new Float32Array(20)] as const,
        ['Float64Array', new Float64Array(20)] as const,
    ];

    it.each(viewCases)('should leave %s views alone', (desc, value) => {
        const result = convertToCopiableValue(value);
        expect(result).toBe(value);
    });

    it('should convert invalid properties in objects recursively', () => {
        const obj = {
            test: 'abc',
            func: function abc() {},
            err: new Error('qwerty'),
            nested: {
                func: function def() {},
                err: new SyntaxError('syntax'),
            },
            arr: [function ghi() {}, new Error('other')],
        };
        const result = convertToCopiableValue(obj);
        expect(result).toEqual({
            test: 'abc',
            func: '[Function abc]',
            err: 'Error: qwerty',
            nested: {
                func: '[Function def]',
                err: 'SyntaxError: syntax',
            },
            arr: ['[Function ghi]', 'Error: other'],
        });
    });

    it('should convert invalid properties in arrays recursively', () => {
        const arr = [
            'abc',
            function abc() {},
            new Error('qwerty'),
            {
                func: function def() {},
                err: new SyntaxError('syntax'),
            },
            [function ghi() {}, new Error('other')],
        ];
        const result = convertToCopiableValue(arr);
        expect(result).toEqual([
            'abc',
            '[Function abc]',
            'Error: qwerty',
            {
                func: '[Function def]',
                err: 'SyntaxError: syntax',
            },
            ['[Function ghi]', 'Error: other'],
        ]);
    });

    it('should remove the metadata property from bots', () => {
        const obj: any = {
            id: 'test',
            metadata: {
                ref: null,
                tags: null,
            },
            tags: {},
        };
        const result = convertToCopiableValue(obj);
        expect(result).toEqual({
            id: 'test',
            tags: {},
        });
    });

    it('should convert functions to a string', () => {
        function test() {}
        const result = convertToCopiableValue(test);

        expect(result).toBe('[Function test]');
    });

    it('should format DateTime objects', () => {
        const value = DateTime.utc(2012, 11, 13, 14, 15, 16);
        const result = convertToCopiableValue(value);
        expect(result).toBe('📅2012-11-13T14:15:16Z');
    });

    it('should format Vector2 objects', () => {
        const value = new Vector2(1, 2);
        const result = convertToCopiableValue(value);
        expect(result).toBe('➡️1,2');
    });

    it('should format Vector3 objects', () => {
        const value = new Vector3(1, 2, 3);
        const result = convertToCopiableValue(value);
        expect(result).toBe('➡️1,2,3');
    });

    it('should format Rotation objects', () => {
        const value = new Rotation();
        const result = convertToCopiableValue(value);
        expect(result).toBe('🔁0,0,0,1');
    });

    const errorCases = [
        ['Error', new Error('abcdef'), 'Error: abcdef'],
        ['SyntaxError', new SyntaxError('xyz'), 'SyntaxError: xyz'],
    ];

    it.each(errorCases)(
        'should convert %s to a string',
        (desc, err, expected) => {
            const result = convertToCopiableValue(err);
            expect(result).toBe(expected);
        }
    );

    it('should convert simple recursive objects', () => {
        let test1 = {
            test2: null as any,
        };
        let test3 = {
            test1: test1,
        };
        let test2 = {
            test3: test3,
        };

        test1.test2 = test2;
        const result = convertToCopiableValue(test1);

        expect(result).toEqual(test1);
    });

    it('should convert deep objects to a string', () => {
        let obj = {} as any;
        let current = obj;
        for (let i = 0; i < 10000; i++) {
            current = current['deep'] = {};
        }

        const result = convertToCopiableValue(obj);

        expect(result).toBe('[Nested object]');
    });

    it('should convert simple bots', () => {
        let bot1 = createDummyRuntimeBot('test1');
        bot1.tags.abc = '123';

        expect(convertToCopiableValue(bot1)).toEqual({
            id: 'test1',
            tags: {
                abc: '123',
            },
        });
    });

    it('should include the space in converted bots', () => {
        let bot1 = createDummyRuntimeBot(
            'test1',
            {
                abc: '123',
            },
            'mySpace' as any
        );

        expect(convertToCopiableValue(bot1)).toEqual({
            id: 'test1',
            space: 'mySpace' as any,
            tags: {
                abc: '123',
            },
        });
    });
});

describe('embedBase64InPdf()', () => {
    it('should reference the given data in the PDF', () => {
        const data = 'abcdefghiabcdefghi';
        const result = embedBase64InPdf(data);

        expect(result).toContain(data);
        expect(result).toMatchSnapshot();
    });
});

describe('getEmbeddedBase64FromPdf()', () => {
    it('should return the data that was embedded in the PDF', () => {
        const data = 'abcdefghiabcdefghi';
        const pdf = embedBase64InPdf(data);
        const result = getEmbeddedBase64FromPdf(pdf);

        expect(result).toEqual(data);
    });
});

describe('formatAuthToken()', () => {
    const cases = [['myToken', 'myService', 'myToken.myService']];

    it.each(cases)('should format %s and %s', (token, service, expected) => {
        const result = formatAuthToken(token, service);

        expect(result).toBe(expected);
    });
});

describe('parseAuthToken()', () => {
    const cases = [
        ['myToken.myService', ['myToken', 'myService']] as const,
        ['myToken.mySer.vice', ['myToken', 'mySer.vice']] as const,
        ['myToken', null as any] as const,
    ] as const;

    it.each(cases)('should format %s and %s', (token, expected) => {
        const result = parseAuthToken(token);

        expect(result).toEqual(expected);
    });
});

describe('fromHexString()', () => {
    const cases: [string, number][] = [
        ['00', 0],
        ['01', 1],
        ['02', 2],
        ['03', 3],
        ['04', 4],
        ['05', 5],
        ['06', 6],
        ['07', 7],
        ['08', 8],
        ['09', 9],
        ['0A', 10],
        ['0B', 11],
        ['0C', 12],
        ['0D', 13],
        ['0E', 14],
        ['0F', 15],

        ['10', 16],
        ['20', 32],
        ['30', 48],
        ['40', 64],
        ['50', 80],
        ['60', 96],
        ['70', 112],
        ['80', 128],
        ['90', 144],
        ['A0', 160],
        ['B0', 176],
        ['C0', 192],
        ['D0', 208],
        ['E0', 224],
        ['F0', 240],
        ['FF', 255],
    ];

    it.each(cases)('should parse %s to %s', (given, expected) => {
        const array = fromHexString(given);
        expect(array).toEqual(new Uint8Array([expected]));
    });

    it('should support long hex strings', () => {
        expect(fromHexString('abcdef1230')).toEqual(
            new Uint8Array([171, 205, 239, 18, 48])
        );
        expect(fromHexString('FFFEFD')).toEqual(
            new Uint8Array([255, 254, 253])
        );
    });
});

describe('toHexString()', () => {
    const cases: [number, string][] = [
        [0, '00'],
        [1, '01'],
        [2, '02'],
        [3, '03'],
        [4, '04'],
        [5, '05'],
        [6, '06'],
        [7, '07'],
        [8, '08'],
        [9, '09'],
        [10, '0a'],
        [11, '0b'],
        [12, '0c'],
        [13, '0d'],
        [14, '0e'],
        [15, '0f'],

        [16, '10'],
        [32, '20'],
        [48, '30'],
        [64, '40'],
        [80, '50'],
        [96, '60'],
        [112, '70'],
        [128, '80'],
        [144, '90'],
        [160, 'a0'],
        [176, 'b0'],
        [192, 'c0'],
        [208, 'd0'],
        [224, 'e0'],
        [240, 'f0'],
        [255, 'ff'],
    ];

    it.each(cases)('should transform %d to %s', (given, expected) => {
        const str = toHexString(new Uint8Array([given]));
        expect(str).toBe(expected);
    });

    it('should support long hex strings', () => {
        expect(toHexString(new Uint8Array([171, 205, 239, 18, 48]))).toBe(
            'abcdef1230'
        );
        expect(toHexString(new Uint8Array([255, 254, 253]))).toBe('fffefd');
    });
});

describe('ensureBotIsSerializable()', () => {
    it.each(customDataTypeCases)(
        'should return a new bot with the copiable version for %s values',
        (desc, given, expected) => {
            const inputBot = createBot('test', {
                value: given,
            });
            let result = ensureBotIsSerializable(inputBot);

            expect(result).toEqual(
                createBot('test', {
                    value: expected,
                })
            );
            expect(result !== inputBot).toBe(true);
        }
    );

    it('should use the original object for tag values', () => {
        const inputBot = createBot('test', {
            value: {
                abc: 'def',
                [ORIGINAL_OBJECT]: {
                    abc: 'abc',
                },
            },
        });
        let result = ensureBotIsSerializable(inputBot);

        expect(result).toEqual(
            createBot('test', {
                value: {
                    abc: 'abc',
                },
            })
        );
        expect(result !== inputBot).toBe(true);
    });

    it('should preserve null tags', () => {
        const inputBot = createBot('test', {
            value: null,
        });
        let result = ensureBotIsSerializable(inputBot);

        expect(result).toEqual(
            createBot('test', {
                value: null,
            })
        );
    });

    it('should return the given bot if everything is normal', () => {
        let b = createBot('test', {
            abc: 123,
            def: 'ghi',
        });
        let result = ensureBotIsSerializable(b);

        expect(result).toBe(b);
    });
});

describe('ensureTagIsSerializable()', () => {
    it.each(customDataTypeCases)(
        'should return a new bot with the copiable version for %s values',
        (desc, given, expected) => {
            let result = ensureTagIsSerializable(given);

            expect(result).toEqual(expected);
        }
    );

    it('should use the original object for tag values', () => {
        const inputValue = {
            abc: 'def',
            [ORIGINAL_OBJECT]: {
                abc: 'abc',
            },
        };
        let result = ensureTagIsSerializable(inputValue);

        expect(result).toEqual({
            abc: 'abc',
        });
        expect(result !== inputValue).toBe(true);
        expect(result === inputValue[ORIGINAL_OBJECT]).toBe(true);
    });

    it('should preserve null tags', () => {
        const inputBot: any = null;
        let result = ensureTagIsSerializable(inputBot);

        expect(result).toEqual(null);
    });

    it('should return the given value if everything is normal', () => {
        let b = {
            abc: 123,
            def: 'ghi',
        };
        let result = ensureTagIsSerializable(b);

        expect(result).toBe(b);
    });
});

describe('isPromise()', () => {
    it('should return true if the value is a promise', () => {
        let p = new Promise((resolve, reject) => {});
        expect(isPromise(p)).toBe(true);
    });

    it('should return false if the value is not a promise', () => {
        expect(isPromise({})).toBe(false);
        expect(
            isPromise({
                then: () => {},
                catch: () => {},
            })
        ).toBe(false);
        expect(isPromise(null)).toBe(false);
        expect(isPromise(undefined)).toBe(false);
        expect(isPromise(123)).toBe(false);
        expect(isPromise('abc')).toBe(false);
        expect(isPromise(true)).toBe(false);
    });
});

/**
 * This includes information about this test package that is needed to test it
 */

export type TestGlue = {
    bounce: (arg: any) => any;
}
export type TestJsBridge = {
    bounce: (arg: any) => any;
    bounceClamped: (arg: any) => any;
}

export default {
    globalArrayName: '__test_go',
    indicies: {
        test_glue: 0,
        test_jsbridge: 1,
    },
};

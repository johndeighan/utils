import {withExt} from '../../src/lib/utils.lib.ts';
export default {
	hCompilers: {
		'.test': {
			getOutPath: (path: string) => withExt(path, '.out'),
			tester: () => true,
			compiler: (path: string) => undefined
			}
		},
	hPostProcessors: {}
	}
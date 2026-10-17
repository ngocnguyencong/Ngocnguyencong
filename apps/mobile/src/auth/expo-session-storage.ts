import * as SecureStore from "expo-secure-store";

import { createSessionStorage, type SecureStoreCompatible } from "./session-storage";

const secureStore = SecureStore as SecureStoreCompatible;

export const expoSessionStorage = createSessionStorage(secureStore);

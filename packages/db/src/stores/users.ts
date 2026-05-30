import { genId } from "../_ids";
import type { DBUser } from "../_store";
import { store } from "../_store";

export const usersStore = {
  findMany: async () => {
    return store.users;
  },
  findOne: async (id: string) => {
    return store.users.find((u) => u.id === id) || null;
  },
  insert: async (user: Omit<DBUser, "id" | "createdAt"> & { id?: string }) => {
    const newUser: DBUser = {
      ...user,
      id: user.id || genId("user"),
      createdAt: new Date(),
    };
    store.users.push(newUser);
    return newUser;
  },
};

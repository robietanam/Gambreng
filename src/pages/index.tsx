"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDebouncedCallback } from "use-debounce";

import { FaSearch } from "react-icons/fa";
import { File } from "@prisma/client";
import { getCookie, setCookie } from "cookies-next";
import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { IoRefresh } from "react-icons/io5";

export default function Home() {
  var userIdCookie = getCookie("userId");
  var usernameCookie = getCookie("username");
  const [userId, setUserId] = useState(userIdCookie ?? "");
  const [username, setUsername] = useState(usernameCookie ?? "");
  const [userFiles, setUserFiles] = useState([]);

  useEffect(() => {
    if (!userId && !username) {
      showUserModal();
    } else {
      getUserInfo(userId);
    }
  }, [userId, username]);

  function showUserModal() {
    document.getElementById("username_modal").showModal();
  }

  async function getUserInfo(userId: String, search?: String) {
    const response = await fetch(
      "/api/user?userId=" + userId + "&search=" + search,
      {
        method: "GET",
      }
    );

    // Handle response if necessary
    const data = await response.json();
    setUserFiles(data.File);
  }

  async function onUsername(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    if (userId == null)
      return document.getElementById("username_modal").showModal();

    const response = await fetch("/api/user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: formData.get("username"),
      }),
    });

    const data = await response.json();

    setCookie("username", data.name);
    setCookie("userId", data.id);

    setUserId(data.id);
    setUsername(data.name);

    document.getElementById("username_modal").close();
    // ...
  }

  async function onFileCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (userId == null || username == null) return;

    const formData = new FormData(event.currentTarget);

    const response = await fetch("/api/file", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileName: formData.get("filename"),
        userName: username,
        userId: userId,
      }),
    });

    getUserInfo(userId);
  }

  const searchParams = useSearchParams();
  const { replace } = useRouter();
  const pathname = usePathname();

  const handleSearch = useDebouncedCallback((term) => {
    console.log(`Searching... ${term}`);
    getUserInfo(userId, term);
    const params = new URLSearchParams(searchParams);

    if (term) {
      params.set("search", term);
    } else {
      params.delete("search");
    }
    replace(`${pathname}?${params.toString()}`);
  }, 300);

  return (
    <div className="bg-white min-w-full min-h-screen overflow-hidden grid grid-cols-7">
      <dialog id="username_modal" className="modal">
        <div className="modal-box">
          <h3 className="font-bold text-lg">Hello!</h3>
          <p className="py-4">Masukkan Username anda</p>

          <form onSubmit={onUsername}>
            <input
              type="text"
              placeholder="Username"
              name="username"
              className="input input-bordered input-sm w-full"
            />
            <div className="modal-action">
              {/* if there is a button in form, it will close the modal */}
              <button className="btn" type="submit">
                Simpan
              </button>
            </div>
          </form>
        </div>
      </dialog>

      <div className=" col-span-2 bg-red-100 flex flex-col justify-end px-1 py-10">
        <div className="col-span-2 bg-red-100 flex flex-row justify-center px-1 py-10 gap-2">
          <div className="flex flex-col gap-2">
            <p className="bg-white p-2 rounded-md text-sm"> username</p>
            <p className=" bg-white p-2 rounded-md text-sm"> userId</p>
          </div>
          <div className="flex flex-col gap-2">
            <p className="bg-white p-2 rounded-md text-sm"> {username}</p>
            <p className=" bg-white p-2 rounded-md text-sm"> {userId}</p>
            <button
              className="btn btn-sm w-full"
              type="submit"
              onClick={() => navigator.clipboard.writeText(userId)}
            >
              Copy Clipboard
            </button>
          </div>
        </div>
        <form
          onSubmit={onFileCreate}
          className=" bg-white px-2 py-5  rounded-lg flex flex-col w-full gap-2 "
        >
          <input
            type="text"
            placeholder="Nama file..."
            name="filename"
            className="input input-bordered input-sm max-w-full"
          />
          <button className="btn btn-sm w-full" type="submit">
            Buat file
          </button>
        </form>
      </div>

      <div className="col-span-5 bg-green-100">
        <div className="flex flex-row">
          <button
            type="button"
            className="text-red-600 border-red-800  hover:text-white hover:bg-red-400 w-fit h-fit p-2 rounded-md border "
            onClick={() => getUserInfo(userId)}
          >
            <IoRefresh />
          </button>
          <div className="relative flex flex-1 flex-shrink-0">
            <label htmlFor="search" className="sr-only">
              Search
            </label>
            <input
              className="peer block w-full rounded-md border border-gray-200 py-[9px] pl-10 text-sm outline-2 placeholder:text-gray-500"
              placeholder="Search file.."
              onChange={(e) => {
                handleSearch(e.target.value);
              }}
              defaultValue={searchParams.get("search")?.toString()}
            />
            <FaSearch className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500 peer-focus:text-gray-900" />
          </div>
        </div>
        <div className="px-2 py-5   flex flex-col w-full gap-2 overflow-y-scroll">
          {userFiles?.map((data: File) => (
            <Link
              className="bg-white rounded-lg py-2 px-3 hover:bg-gray-100 flex flex-row justify-between"
              key={data.id}
              href={`/draw?fileId=${data.id}`}
            >
              {data.fileName}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

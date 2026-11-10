from getpass import getpass

import pymysql


def main() -> None:
    password = getpass("Mot de passe MySQL : ")

    try:
        connection = pymysql.connect(
            host="localhost",
            port=3306,
            user="root",
            password=password,
            database="orders_db",
            connect_timeout=5,
        )

        with connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT DATABASE(), VERSION()")
                result = cursor.fetchone()
                print("Connexion MySQL réussie !")
                print("Base :", result[0])
                print("Version MySQL :", result[1])

    except pymysql.MySQLError as error:
        print("Échec de connexion MySQL :", error)


if __name__ == "__main__":
    main()

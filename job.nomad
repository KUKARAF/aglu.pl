job "nginx-static" {
  datacenters = ["dc1"]
  type = "service"

  group "nginx-podman" {
    count = 1

    constraint {
      attribute = "${attr.driver.podman.version}"
      operator  = "is_set"
    }

    network {
      port "http" {
        static = 8987
      }
    }

    task "nginx" {
      driver = "podman"

      config {
        image = "nginx-static:latest"
        ports = ["http"]
      }

      resources {
        cpu    = 500
        memory = 256
      }
    }
  }

  group "nginx-docker" {
    count = 1

    constraint {
      attribute = "${attr.driver.podman.version}"
      operator  = "is_not_set"
    }

    constraint {
      attribute = "${attr.driver.docker.version}"
      operator  = "is_set"
    }

    network {
      port "http" {
        static = 8987
      }
    }

    task "nginx" {
      driver = "docker"

      config {
        image = "nginx-static:latest"
        ports = ["http"]
      }

      resources {
        cpu    = 500
        memory = 256
      }
    }
  }
}
